import { SITE_URL } from './api';

/**
 * Shared SEO helpers. Every public page builds its metadata here so canonical
 * URLs, OpenGraph and Twitter cards never drift between routes.
 */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  imageUrl?: string;
}) {
  const url = `${SITE_URL}${opts.path}`;
  const image = opts.imageUrl ?? '/og-default.png';
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website' as const,
      siteName: 'DrillKe',
      title: opts.title,
      description: opts.description,
      url,
      images: [{ url: image, alt: opts.title }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: opts.title,
      description: opts.description,
      images: [image],
    },
  };
}

/**
 * JSON-LD for a song. `MusicRecording` is the schema search engines use to
 * surface lyrics and playback; see docs/architecture.md §6.
 */
export function songJsonLd(song: {
  title: string;
  slug: string;
  artistNames: string[];
  youtubeVideoId: string;
  releaseDate: string | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: song.title,
    url: `${SITE_URL}/songs/${song.slug}`,
    byArtist: song.artistNames.map((name) => ({ '@type': 'MusicGroup', name })),
    ...(song.releaseDate ? { datePublished: song.releaseDate } : {}),
    ...(song.youtubeVideoId
      ? { sameAs: [`https://www.youtube.com/watch?v=${song.youtubeVideoId}`] }
      : {}),
  };
}

export function artistJsonLd(artist: { name: string; slug: string; bio: string | null }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.name,
    url: `${SITE_URL}/artists/${artist.slug}`,
    ...(artist.bio ? { description: artist.bio } : {}),
  };
}

export function eventJsonLd(event: {
  title: string;
  slug: string;
  startsAt: string;
  venue: string | null;
  city: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: event.startsAt,
    url: `${SITE_URL}/events/${event.slug}`,
    location: {
      '@type': 'Place',
      name: event.venue ?? event.city,
      address: { '@type': 'PostalAddress', addressLocality: event.city },
    },
  };
}
