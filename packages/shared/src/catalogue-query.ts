/**
 * The catalogue query contract — parsing and the ordering rules behind
 * `GET /api/songs`.
 *
 * Pure, so the web app can build the same URLs the API understands and the API
 * can reject a bad sort exactly once, instead of every page quietly inventing
 * its own fallback. See `docs/api.md` § Songs & lyrics.
 *
 * Why this exists: a channel import can hold 150 uploads, and the only way in
 * used to be "page 1, sorted by release date". Two questions a listener
 * actually asks — "what can I read along to?" and "what was timed most
 * recently?" — had no answer that lived in a URL.
 */

import type { Language } from './types.ts';

export const SONG_SORTS = ['newest', 'title', 'artist', 'recently-synced'] as const;
export type SongSort = (typeof SONG_SORTS)[number];

export const SYNC_FILTERS = ['synced', 'unsynced'] as const;
export type SyncFilter = (typeof SYNC_FILTERS)[number];

export const SONG_LANGUAGES = ['sheng', 'swahili', 'english', 'mixed'] as const;

/** The default order is the one the catalogue shipped with. */
export const DEFAULT_SONG_SORT: SongSort = 'newest';

/** A fully validated catalogue query: everything optional, everything normal. */
export interface CatalogueQuery {
  q?: string;
  artist?: string;
  sync?: SyncFilter;
  language?: Language;
  sort: SongSort;
  page: number;
}

export type CatalogueQueryError = {
  field: 'sync' | 'language' | 'sort';
  value: string;
  message: string;
};

export type CatalogueQueryResult =
  | { ok: true; query: CatalogueQuery }
  | { ok: false; errors: CatalogueQueryError[] };

/** Trimmed input as it arrives on the wire: every field a string or absent. */
export interface RawCatalogueQuery {
  q?: string;
  artist?: string;
  sync?: string;
  language?: string;
  sort?: string;
  page?: string | number;
}

function oneOf<T extends string>(values: readonly T[], value: string | undefined): T | undefined {
  if (value == null) return undefined;
  const needle = value.trim().toLowerCase();
  return (values as readonly string[]).includes(needle) ? (needle as T) : undefined;
}

/**
 * Parse a raw query into the contract, or refuse it.
 *
 * An unknown `sort`, `sync` or `language` is a **400**, not a silent fallback:
 * falling back to `newest` would serve a page that looks like the answer to
 * "sort by title" while ignoring it. `page` is the one lenient field — it is
 * always clamped rather than rejected, because a bad page number is a mangled
 * link, not a request for a different list.
 */
export function parseCatalogueQuery(raw: RawCatalogueQuery): CatalogueQueryResult {
  const errors: CatalogueQueryError[] = [];

  const sync = pick(raw.sync, SYNC_FILTERS, 'sync', errors);
  const language = pick(raw.language, SONG_LANGUAGES, 'language', errors);
  const sort = pick(raw.sort, SONG_SORTS, 'sort', errors) ?? DEFAULT_SONG_SORT;

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    query: {
      ...(raw.q?.trim() ? { q: raw.q.trim() } : {}),
      ...(raw.artist?.trim() ? { artist: raw.artist.trim() } : {}),
      ...(sync ? { sync } : {}),
      ...(language ? { language } : {}),
      sort,
      page: pageNumber(raw.page),
    },
  };
}

function pick<T extends string>(
  value: string | undefined,
  values: readonly T[],
  field: CatalogueQueryError['field'],
  errors: CatalogueQueryError[],
): T | undefined {
  if (value == null || value.trim() === '') return undefined;
  const parsed = oneOf(values, value);
  if (!parsed) {
    errors.push({ field, value, message: `${field} must be one of: ${values.join(', ')}` });
  }
  return parsed;
}

/** Same rule the service has always used: a positive integer, capped. */
export function pageNumber(value?: string | number): number {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

/**
 * The rules the order compiles to.
 *
 * Kept separate from Prisma so the tricky part — that "recently synced" is
 * meaningless for a song with no timed version — is unit-tested rather than
 * rediscovered in production.
 */
export interface OrderPlan {
  /** Whether the query is restricted to songs with (or without) a timed version. */
  sync: SyncFilter | null;
  keys: ('releaseDate' | 'title' | 'syncedAt' | 'id')[];
  directions: ('asc' | 'desc')[];
}

/**
 * Compile a validated query into what the database is asked to do.
 *
 *   - `recently-synced` **forces** `sync: 'synced'`. A song that has never been
 *     timed has no sync date; including it would mean ordering a list by a
 *     column that is null for half the rows.
 *   - Every order ends on `id`, so pagination is stable: two songs released on
 *     the same day cannot swap places between page 1 and page 2 and be shown
 *     twice (or never).
 *   - `artist` is ordered by primary artist name. Songs with no credited artist
 *     sort last in the service's tiebreak, not here — the join is a Prisma
 *     detail, and this function stays pure.
 */
export function compileOrderPlan(query: Pick<CatalogueQuery, 'sort' | 'sync'>): OrderPlan {
  if (query.sort === 'recently-synced') {
    return { sync: 'synced', keys: ['syncedAt', 'id'], directions: ['desc', 'asc'] };
  }
  if (query.sort === 'title') {
    return { sync: query.sync ?? null, keys: ['title', 'id'], directions: ['asc', 'asc'] };
  }
  if (query.sort === 'artist') {
    return { sync: query.sync ?? null, keys: ['id'], directions: ['asc'] };
  }
  return { sync: query.sync ?? null, keys: ['releaseDate', 'id'], directions: ['desc', 'asc'] };
}

export type CatalogueParams = Partial<Omit<CatalogueQuery, 'sort'>> & { sort?: SongSort };

/**
 * Build the `/songs` query string both the API and the web app agree on.
 * Absent values are omitted, so the plain catalogue stays `/songs` rather than
 * `/songs?sort=newest&page=1`.
 */
export function catalogueSearchParams(params: CatalogueParams): string {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set('q', params.q.trim());
  if (params.artist?.trim()) qs.set('artist', params.artist.trim());
  if (params.sync) qs.set('sync', params.sync);
  if (params.language) qs.set('language', params.language);
  if (params.sort && params.sort !== DEFAULT_SONG_SORT) qs.set('sort', params.sort);
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  return qs.toString();
}