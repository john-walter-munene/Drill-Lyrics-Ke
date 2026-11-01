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

/** Browser-facing API origin. Exported: credentials must be handled there. */
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SERVER_API_URL = process.env.API_INTERNAL_URL ?? PUBLIC_API_URL;
// Server components run inside the web container and must use Docker DNS;
// browser submissions use the host-reachable public URL.
export const API_URL = typeof window === 'undefined' ? SERVER_API_URL : PUBLIC_API_URL;
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// --- Session token -----------------------------------------------------------
//
// The API sets an HttpOnly cookie AND returns the token. The cookie is the
// normal path; the token is the fallback for browsers that will not store a
// cookie for the API origin (web and API on different sites, third-party cookie
// blocking). Keep only the JWT string here — it carries a session id and an
// expiry and is revoked server-side on sign-out, like the cookie.

const TOKEN_KEY = 'drillke.session';
const canUseStorage = () => typeof window !== 'undefined';

export function storeToken(token: string): void {
  try { window.localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode */ }
}

export function readToken(): string | null {
  if (!canUseStorage()) return null;
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function clearToken(): void {
  if (!canUseStorage()) return;
  try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

/** Headers for a browser request: JSON body plus the fallback credential. */
function browserHeaders(json = false): Record<string, string> {
  const token = readToken();
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export async function browserGet<T>(path: string): Promise<T | null> {
  try { const res = await fetch(`${PUBLIC_API_URL}${path}`, { credentials: 'include', headers: browserHeaders(), cache: 'no-store' }); return res.ok ? await res.json() as T : null; }
  catch { return null; }
}

interface SessionUserResponse {
  user: { id: string; email: string; displayName: string; role: string };
}

/** Sign-in/sign-up also hand back the token, so the cookie is not the only hope. */
type AuthResult = SessionUserResponse & { token?: string; expiresAt?: string };

/**
 * The signed-in account, or the reason there isn't one.
 *
 * Unlike `browserGet`, a failure keeps its status: "401, sign in" and "500, the
 * API is down" need different UIs, and a null-returning helper collapses them
 * into the same empty screen.
 */
export async function getSessionUser(): Promise<
  | { ok: true; user: { id: string; email: string; displayName: string; role: string } }
  | { ok: false; status: number; message: string }
> {
  try {
    // `session` uses the required jwt guard, so "no session" is a 401 rather
    // than a 200 with an empty body — and it accepts the bearer fallback.
    const res = await fetch(`${PUBLIC_API_URL}/api/auth/session`, {
      credentials: 'include',
      headers: browserHeaders(),
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as { user?: { id: string; email: string; displayName: string; role: string }; message?: string | string[] };
    if (!res.ok) {
      const message = Array.isArray(data.message) ? data.message.join(' ') : data.message ?? `Request failed (${res.status})`;
      // A dead token must not be replayed on every later request.
      if (res.status === 401) { clearToken(); return { ok: false, status: 401, message: 'Your session has ended. Sign in again.' }; }
      return { ok: false, status: res.status, message };
    }
    if (!data.user) return { ok: false, status: 401, message: 'Your session has ended. Sign in again.' };
    return { ok: true, user: data.user };
  } catch {
    return { ok: false, status: 0, message: 'Cannot reach the API — check that it is running, then reload.' };
  }
}

/**
 * Sign in goes to the PUBLIC API origin explicitly, exactly like the session
 * cookie does. `postJson` resolves to the server-internal URL on the server,
 * which is right for fetches that need Docker DNS but wrong for credentials:
 * the cookie lands on `API_INTERNAL_URL`, and the browser never sees it.
 */
export const signIn = (body: { email: string; password: string }) =>
  publicPostJson<AuthResult>('/api/auth/signin', body);
export const signUp = (body: { email: string; password: string; displayName: string }) =>
  publicPostJson<AuthResult>('/api/auth/signup', body);

/** Sign out on the server AND forget the local fallback token. */
export async function signOut() {
  const result = await publicPostJson<{ ok: boolean }>('/api/auth/signout', {});
  clearToken();
  return result;
}

/**
 * Ask for a reset link. The API answers `accepted: true` whether or not the
 * address has an account, so the UI must say the same thing either way.
 */
export const requestPasswordReset = (email: string) =>
  postJson<{ accepted: boolean }>('/api/auth/forgot-password', { email });

/** Whether a reset link is still usable, before the user types a password. */
export async function checkResetToken(token: string) {
  return browserGet<{ valid: boolean }>(`/api/auth/reset-password/${encodeURIComponent(token)}`);
}

export const completePasswordReset = (token: string, password: string) =>
  postJson<{ ok: boolean }>('/api/auth/reset-password', { token, password });

/** Requires the current password: a borrowed session must not delete an account. */
export const deleteAccount = (password: string) =>
  postJson<{ ok: boolean }>('/api/auth/delete-account', { password });

// --- Email confirmation ------------------------------------------------------

export async function getConfirmationStatus() {
  return browserGet<{ verified: boolean; email: string; verifiedAt: string | null }>('/api/auth/confirmation');
}

export const resendConfirmation = () => postJson<{ accepted: boolean; sent: boolean }>('/api/auth/confirmation/resend', {});

/**
 * Spend a confirmation link. Idempotent: a second click reports
 * `already_confirmed` rather than an error, because clicking twice is not a
 * mistake the user needs to fix.
 */
export const confirmEmail = (token: string) =>
  postJson<{ ok: boolean; status: 'confirmed' | 'already_confirmed' }>('/api/auth/confirm-email', { token });

// --- Account data export -----------------------------------------------------

/**
 * Everything the site holds about the account, as JSON.
 *
 * Fetched with credentials and saved by the browser as a file. Built client-side
 * rather than streamed so the download never depends on a `Content-Disposition`
 * header surviving an API proxy.
 */
export async function exportAccountData(): Promise<{ ok: true; filename: string } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${PUBLIC_API_URL}/api/auth/export`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) return { ok: false, message: `Export failed (${response.status}).` };
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `drillke-account-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return { ok: true, filename: link.download };
  } catch {
    return { ok: false, message: 'Export failed — check your connection and try again.' };
  }
}

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string | string[] }> {
  try {
    const res = await fetch(`${PUBLIC_API_URL}${path}`, {
      method,
      headers: browserHeaders(true),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: 'include',
      cache: 'no-store',
    });
    // The API returns JSON on both success and failure; a non-JSON body (a proxy
    // error page, a 502 from the edge) must not throw here.
    const data = await res.json().catch(() => ({})) as T & { message?: string | string[] };
    if (!res.ok) return { ok: false, status: res.status, message: data.message ?? 'Request failed' };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: 'Network error' };
  }
}

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

/** POST that must always reach the browser-facing origin (see `signIn`). */
export async function publicPostJson<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string | string[] }> {
  try {
    const res = await fetch(`${PUBLIC_API_URL}${path}`, {
      method: 'POST',
      headers: browserHeaders(true),
      body: JSON.stringify(body),
      credentials: 'include',
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as unknown;
    if (!res.ok) {
      const message = (data as { message?: string | string[] }).message ?? `Request failed (${res.status})`;
      return { ok: false, status: res.status, message };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, message: 'Cannot reach the API — is it running?' };
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

export async function listSongs(
  params: { q?: string; artist?: string; page?: number } = {},
  revalidate = 120,
) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.artist) qs.set('artist', params.artist);
  if (params.page) qs.set('page', String(params.page));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return (await getJson<Page<Song>>(`/api/songs${suffix}`, revalidate)) ?? EMPTY_PAGE;
}

/**
 * The home-page shelves. One request for three feeds, so the landing page is a
 * single API round trip rather than four.
 *
 * Revalidated every few minutes: new songs should appear without a deploy, but
 * a home page that queries on every hit is the first thing to fall over.
 */
export interface HomeFeeds {
  /** Published songs drawn at random from across the whole catalogue. */
  randomSongs: Song[];
  newSongs: Song[];
  syncedSongs: Song[];
  emergingArtists: { slug: string; name: string; imageUrl: string | null; publishedSongs: number }[];
}

const EMPTY_FEEDS: HomeFeeds = { randomSongs: [], newSongs: [], syncedSongs: [], emergingArtists: [] };

export async function getHomeFeeds(revalidate = 120): Promise<HomeFeeds> {
  return (await getJson<HomeFeeds>('/api/songs/feeds', revalidate)) ?? EMPTY_FEEDS;
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

export async function getTopContributors() {
  return (await getJson<{ items: { name: string; publishedContributions: number }[] }>('/api/lyrics/contributors/top', 120)) ?? { items: [] };
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
