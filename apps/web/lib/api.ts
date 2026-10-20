import type {
  Artist,
  Dj,
  DrillEvent,
  LyricsPayload,
  Page,
  Podcast,
  PodcastEpisode,
  SearchResults,
  Song,
} from '@drillke/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * GET JSON with ISR revalidation. Returns `null` on any failure so pages can
 * render their empty state instead of throwing — public pages must never 500
 * because the API restarted.
 */
async function getJson<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Authenticated POST (session cookie forwarded from the browser). */
export async function postJson<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string | string[] }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
      cache: 'no-store',
    });
    const data = (await res.json()) as unknown;
    if (!res.ok) {
      const message = (data as { message?: string | string[] }).message ?? 'Request failed';
      return { ok: false, status: res.status, message };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, message: 'Network error' };
  }
}

const EMPTY_PAGE: Page<never> = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

// --- Catalogue ---------------------------------------------------------------

export async function listSongs(params: { q?: string; artist?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.artist) qs.set('artist', params.artist);
  if (params.page) qs.set('page', String(params.page));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return (await getJson<Page<Song>>(`/api/songs${suffix}`, 120)) ?? EMPTY_PAGE;
}

export async function getSong(slug: string): Promise<Song | null> {
  return getJson<Song>(`/api/songs/${encodeURIComponent(slug)}`, 300);
}

/** The one lyrics payload per song — never fetched per line. */
export async function getLyrics(slug: string): Promise<LyricsPayload | null> {
  return getJson<LyricsPayload>(`/api/songs/${encodeURIComponent(slug)}/lyrics`, 300);
}

export async function listArtists(params: { q?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return (await getJson<Page<Artist>>(`/api/artists${suffix}`, 300)) ?? EMPTY_PAGE;
}

export async function getArtist(slug: string): Promise<Artist | null> {
  return getJson<Artist>(`/api/artists/${encodeURIComponent(slug)}`, 300);
}

// --- The scene ---------------------------------------------------------------

export async function listDjs(params: { city?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.city) qs.set('city', params.city);
  if (params.page) qs.set('page', String(params.page));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return (await getJson<Page<Dj>>(`/api/djs${suffix}`, 300)) ?? EMPTY_PAGE;
}

export async function getDj(slug: string): Promise<Dj | null> {
  return getJson<Dj>(`/api/djs/${encodeURIComponent(slug)}`, 300);
}

export async function listPodcasts(params: { page?: number } = {}) {
  const suffix = params.page ? `?page=${params.page}` : '';
  return (await getJson<Page<Podcast>>(`/api/podcasts${suffix}`, 300)) ?? EMPTY_PAGE;
}

export async function getPodcast(slug: string): Promise<Podcast | null> {
  return getJson<Podcast>(`/api/podcasts/${encodeURIComponent(slug)}`, 300);
}

export async function getEpisode(slug: string, number: number): Promise<PodcastEpisode | null> {
  return getJson<PodcastEpisode>(`/api/podcasts/${encodeURIComponent(slug)}/episodes/${number}`, 300);
}

export async function listEvents(params: { from?: string; city?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.city) qs.set('city', params.city);
  if (params.page) qs.set('page', String(params.page));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return (await getJson<Page<DrillEvent>>(`/api/events${suffix}`, 120)) ?? EMPTY_PAGE;
}

export async function getEvent(slug: string): Promise<DrillEvent | null> {
  return getJson<DrillEvent>(`/api/events/${encodeURIComponent(slug)}`, 300);
}

// --- Search ------------------------------------------------------------------

const EMPTY_SEARCH: SearchResults = {
  query: '',
  songs: [],
  artists: [],
  djs: [],
  podcasts: [],
  events: [],
};

export async function search(q: string): Promise<SearchResults> {
  const query = q.trim();
  if (query.length < 2) return { ...EMPTY_SEARCH, query };
  const data = await getJson<SearchResults>(
    `/api/search?q=${encodeURIComponent(query)}`,
    0,
  );
  return data ?? { ...EMPTY_SEARCH, query };
}

// --- Sitemap -----------------------------------------------------------------

export async function listSitemapPaths(): Promise<{ path: string; updatedAt: string }[]> {
  return (await getJson<{ path: string; updatedAt: string }[]>(`/api/sitemap`, 3600)) ?? [];
}
