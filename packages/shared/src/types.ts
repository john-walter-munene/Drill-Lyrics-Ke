/**
 * Domain types shared by the web app, the API and any future client.
 *
 * These mirror the API contract in `docs/api.md` and the Prisma models in
 * `prisma/schema.prisma`. They are intentionally hand-written rather than
 * derived from the Prisma client so the web bundle never depends on Prisma.
 */

export const ROLES = ['member', 'contributor', 'moderator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export type Language = 'sheng' | 'swahili' | 'english' | 'mixed';

export const SONG_STATUSES = [
  'draft',
  'pending',
  'published',
  'unpublished',
] as const;
export type SongStatus = (typeof SONG_STATUSES)[number];

export const SUBMISSION_STATUSES = [
  'draft',
  'pending',
  'changes_requested',
  'approved',
  'published',
  'rejected',
  'unpublished',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** A lyric version is either timed line-by-line or plain text. */
export type SyncStatus = 'unsynchronized' | 'synchronized';

/** Outbound links shown on artist, DJ and podcast pages. */
export interface ExternalLink {
  label: string;
  url: string;
}

/** Public shape of an account, as returned by `GET /api/auth/me`. */
export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
}

export interface ArtistSummary {
  slug: string;
  name: string;
}

export interface Artist extends ArtistSummary {
  id: string;
  bio: string | null;
  imageUrl: string | null;
  youtubeChannelId: string | null;
  verified: boolean;
  links: ExternalLink[];
  songCount: number;
}

export interface SongSummary {
  slug: string;
  title: string;
  artistNames: string[];
}

export interface Song extends SongSummary {
  id: string;
  artists: ArtistSummary[];
  featuring: ArtistSummary[];
  youtubeVideoId: string;
  language: Language;
  releaseDate: string | null; // YYYY-MM-DD
  durationMs: number | null;
  status: SongStatus;
  lyrics: {
    syncStatus: SyncStatus;
    versionId: string | null;
  };
}

export interface Dj extends ArtistSummary {
  id: string;
  bio: string | null;
  imageUrl: string | null;
  city: string | null;
  links: ExternalLink[];
  tracks: SongSummary[];
}

export type PodcastPlatform = 'youtube' | 'spotify' | 'anchor' | 'other';

export interface Podcast {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  hostName: string | null;
  imageUrl: string | null;
  episodeCount: number;
}

export interface PodcastEpisode {
  id: string;
  number: number;
  title: string;
  publishedAt: string;
  durationMs: number | null;
  externalUrl: string;
  platform: PodcastPlatform;
  songs: SongSummary[];
  artists: ArtistSummary[];
}

export interface DrillEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  venue: string | null;
  city: string;
  startsAt: string;
  endsAt: string | null;
  ticketUrl: string | null;
  ticketPrice: string | null;
  imageUrl: string | null;
  lineup: {
    artists: ArtistSummary[];
    djs: ArtistSummary[];
  };
}

export type ReportTargetType =
  | 'song'
  | 'lyric_version'
  | 'annotation'
  | 'artist'
  | 'dj'
  | 'podcast_episode'
  | 'event'
  | 'user';

export interface SearchHead {
  slug: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
}

export interface SearchResults {
  query: string;
  songs: SearchHead[];
  artists: SearchHead[];
  djs: SearchHead[];
  podcasts: SearchHead[];
  events: SearchHead[];
}

/** Standard page envelope every list endpoint returns. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Standard error envelope produced by the API's exception filter. */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}
