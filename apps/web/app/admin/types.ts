import type { Annotation } from '@drillke/shared';

/**
 * Response shapes the admin dashboard reads.
 *
 * These mirror what `AdminService` returns (`docs/api.md` §Administration).
 * They are declared rather than inferred because the API and the web app are
 * separate deployables — the dashboard must not gain or lose a field silently
 * when the server changes, and `any` would hide exactly that.
 */

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: 'member' | 'contributor' | 'moderator' | 'admin';
  createdAt: string;
}

export interface OverviewCounts {
  artists: number;
  publishedSongs: number;
  pendingLyrics: number;
  pendingArtistSuggestions: number;
  draftSongs: number;
  members: number;
}

export interface ReviewSong {
  id: string;
  title: string;
  slug: string;
  youtubeVideoId: string;
  artists: { artist: { name: string } }[];
}

export interface LyricsReviewItem {
  id: string;
  status: 'draft' | 'pending' | 'changes_requested' | 'approved' | 'published' | 'rejected' | 'unpublished';
  markdown: string;
  note?: string | null;
  createdAt: string;
  user?: { id: string; displayName: string } | null;
  song: ReviewSong;
  publishedVersion?: { annotations: Annotation[] } | null;
}

export interface ArtistSuggestionItem {
  id: string;
  suggestedName?: string | null;
  channelTitle: string;
  youtubeChannelId: string;
  channelDescription?: string | null;
  submitter?: { displayName: string } | null;
  sampleVideos: { videoId: string; title: string }[];
}

export interface AdminArtistItem {
  id: string;
  name: string;
  slug: string;
  youtubeChannelId: string;
  _count: { songs: number };
  importedDrafts: number;
  importedPublished: number;
  youtubeSync?: {
    lastSyncAt: string | null;
    lastError: string | null;
    pausedByFilter: boolean;
    initialImportComplete: boolean;
    lastScanned: number;
    lastCreated: number;
  } | null;
}

/**
 * What one acquisition pass did (`SyncResult` on the API).
 *
 * `error` is not a failure of the request: the pass returns partial counts with
 * what it managed to import before YouTube refused, so a long channel can be
 * resumed rather than restarted.
 */
export interface SyncResult {
  pages?: number;
  pagesThisPass?: number;
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
  drafts: number;
  published: number;
  complete: boolean;
  pausedReason: string | null;
  error?: string;
}

export interface AcquisitionStatus {
  configured: boolean;
  setup?: string;
  artistsWithoutChannel: number;
  artistsWithChannel: number;
  importedDrafts: number;
  importedPublished: number;
}

export interface ChannelPreview {
  channelId: string;
  title: string;
  description: string | null;
  sampleVideos: { videoId: string; title: string; publishedAt: string | null }[];
}

export interface AddArtistResponse {
  artist: { id: string; name: string; slug: string };
  channel?: { title: string; channelId: string };
  alreadyExists: boolean;
  sync: SyncResult | null;
  summary?: { drafts: number; published: number };
}

export interface SongDraftItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  youtubeVideoId: string;
  releaseDate: string | null;
  youtubeImportKind: string | null;
  youtubeImportReason: string | null;
  artists: { artist: { name: string } }[];
}

export interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  meta: unknown;
  actor?: { displayName: string } | null;
}

export interface Paged<T> {
  items: T[];
}
