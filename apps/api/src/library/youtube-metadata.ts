/** Public metadata returned by YouTube's oEmbed endpoint for an embeddable video. */
export interface YoutubeVideoMetadata {
  videoId: string;
  title: string;
  authorName: string;
  authorUrl: string;
  thumbnailUrl: string;
  /** oEmbed exposes a display name and URL, but not the stable channel ID. */
  channelId: null;
}

interface YoutubeOEmbedResponse {
  title?: unknown;
  author_name?: unknown;
  author_url?: unknown;
  thumbnail_url?: unknown;
}

/**
 * Extract public title/channel-label/thumbnail metadata for a YouTube video.
 * This calls YouTube's oEmbed endpoint; it does not scrape YouTube HTML.
 * Use the YouTube Data API when a stable channel ID or full catalogue import is needed.
 */
export async function extractYoutubeVideoMetadata(
  input: string,
  fetcher: typeof fetch = fetch,
): Promise<YoutubeVideoMetadata> {
  const videoId = getYoutubeVideoId(input);
  const endpoint = new URL('https://www.youtube.com/oembed');
  endpoint.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`);
  endpoint.searchParams.set('format', 'json');

  const response = await fetcher(endpoint, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`YouTube metadata request failed with ${response.status}`);
  }
  const data = await response.json() as YoutubeOEmbedResponse;
  const title = asNonEmptyString(data.title);
  const authorName = asNonEmptyString(data.author_name);
  const authorUrl = asTrustedYoutubeUrl(data.author_url);
  const thumbnailUrl = asTrustedYoutubeUrl(data.thumbnail_url);
  if (!title || !authorName || !authorUrl || !thumbnailUrl) {
    throw new Error('YouTube returned incomplete public video metadata');
  }
  return { videoId, title, authorName, authorUrl, thumbnailUrl, channelId: null };
}

export function getYoutubeVideoId(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Enter a valid YouTube video URL');
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  let videoId: string | null = null;
  if (hostname === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
  if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'music.youtube.com') {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v');
    else if (/^\/(embed|shorts)\//.test(url.pathname)) videoId = url.pathname.split('/')[2] ?? null;
  }
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new Error('The URL does not contain a valid YouTube video ID');
  }
  return videoId;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asTrustedYoutubeUrl(value: unknown): string | null {
  const raw = asNonEmptyString(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const trustedHost = host === 'youtube.com' || host.endsWith('.youtube.com')
      || host === 'ytimg.com' || host.endsWith('.ytimg.com');
    return url.protocol === 'https:' && trustedHost ? url.toString() : null;
  } catch {
    return null;
  }
}
