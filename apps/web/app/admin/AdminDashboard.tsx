'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Annotation, Role } from '@drillke/shared';
import { apiRequest, clearToken, getSessionUser, readToken } from '../../api';
import LyricsReviewCard from './LyricsReviewCard';
import type {
  AcquisitionStatus,
  AddArtistResponse,
  AdminArtistItem,
  AdminUser,
  ArtistSuggestionItem,
  AuditLogItem,
  ChannelPreview,
  LyricsReviewItem,
  OverviewCounts,
  SongDraftItem,
} from './types';

/**
 * Staff workspace shell.
 *
 * This component owns two things only: which section is showing, and the single
 * `act()` helper that writes to the API and reloads. Each section renders its
 * own typed panel, so adding a section does not mean threading another `any`
 * through one giant JSX expression.
 *
 * Access is checked in `load()`: a caller who is not staff is sent to `/sign-in`
 * before any data is fetched.
 */

const TABS = ['Overview', 'Lyrics review', 'Artist suggestions', 'Artists & sync', 'Song imports', 'Users & roles', 'Audit'] as const;
type Tab = (typeof TABS)[number];

const ENDPOINTS: Record<Exclude<Tab, 'Overview'>, string> = {
  'Lyrics review': '/api/admin/lyrics/queue',
  'Artist suggestions': '/api/admin/artist-suggestions',
  'Artists & sync': '/api/admin/artists',
  'Song imports': '/api/admin/songs/drafts',
  'Users & roles': '/api/admin/users',
  Audit: '/api/admin/audit',
};

const STAFF_ROLES: readonly Role[] = ['admin', 'moderator'];

/** Admin-only endpoints; a moderator is never offered the tab that calls them. */
const ADMIN_ONLY_TABS: Tab[] = ['Users & roles', 'Audit'];

/**
 * Why the dashboard could not open. Distinguished on purpose: "sign in" and
 * "your account is not staff" are different problems with different fixes, and
 * a page that sends a signed-in member to the sign-in form — where signing in
 * again plainly does not help — is how "admin login is broken" gets reported.
 */
type AccessState =
  | { kind: 'checking' }
  | { kind: 'ready' }
  | { kind: 'signed_out'; message: string }
  | { kind: 'not_staff'; email: string; role: string }
  | { kind: 'unreachable'; message: string };

/** Any list endpoint may return a bare array or a `{ items }` page. */
function toItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export default function AdminDashboard() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [access, setAccess] = useState<AccessState>({ kind: 'checking' });
  const [tab, setTab] = useState<Tab>('Overview');
  const [lyricsStatus, setLyricsStatus] = useState('pending');
  // Set when "Review drafts" is pressed for one channel: the imports tab then
  // shows only that artist's candidates instead of the whole queue.
  const [draftArtistId, setDraftArtistId] = useState<string | null>(null);
  const [items, setItems] = useState<unknown[]>([]);
  const [overview, setOverview] = useState<OverviewCounts | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const visibleTabs = user?.role === 'admin'
    ? TABS
    : TABS.filter((name) => !ADMIN_ONLY_TABS.includes(name));

  /** Resolve the session. Returns the staff user, or null with `access` set. */
  const checkAccess = useCallback(async (): Promise<AdminUser | null> => {
    const session = await getSessionUser();
    if (!session.ok) {
      // A page loaded straight after sign-in can run this before the browser has
      // applied the Set-Cookie, so a 401 here would bounce a caller who has a
      // perfectly good session. The token IS the session; retry once with it
      // attached, and only then believe the 401.
      if (session.status === 401 && readToken() && retryToken < 1) {
        setRetryToken((n) => n + 1);
        return null;
      }
      setAccess(session.status === 0
        ? { kind: 'unreachable', message: session.message }
        : { kind: 'signed_out', message: session.message });
      return null;
    }
    const { user: account } = session;
    if (!(STAFF_ROLES as readonly string[]).includes(account.role)) {
      setAccess({ kind: 'not_staff', email: account.email, role: account.role });
      return null;
    }
    setUser(account as AdminUser);
    setAccess({ kind: 'ready' });
    // Staff status confirmed. Leave the fallback credential out of every later
    // request: the cookie is now authoritative, and a copied or stale token in
    // localStorage must not outlive the session it was stored from.
    clearToken();
    return account as AdminUser;
  }, [retryToken]);

  const load = useCallback(async () => {
    if (!(await checkAccess())) return;

    if (tab === 'Overview') {
      const result = await apiRequest<OverviewCounts>('GET', '/api/admin/overview');
      if (result.ok) setOverview(result.data);
      return;
    }

    const base = ENDPOINTS[tab];
    const path = tab === 'Lyrics review'
      ? `${base}?status=${encodeURIComponent(lyricsStatus)}`
      : tab === 'Song imports' && draftArtistId
        ? `${base}?artistId=${encodeURIComponent(draftArtistId)}`
        : base;
    const result = await apiRequest<unknown>('GET', path);
    if (result.ok) { setItems(toItems(result.data)); return; }
    // 401 mid-session (or a cookie that never arrived) is an access problem,
    // not an empty list — say so instead of rendering "Nothing here yet".
    if (result.status === 401) { setAccess({ kind: 'signed_out', message: 'Your session has ended. Sign in again.' }); return; }
    if (result.status === 403) { setAccess({ kind: 'not_staff', email: '', role: 'member' }); return; }
    setNotice(Array.isArray(result.message) ? result.message.join(' ') : String(result.message));
  }, [checkAccess, tab, lyricsStatus, draftArtistId]);

  useEffect(() => { void load(); }, [load, retryToken]);

  /** The single write path: run the action, report the outcome, refresh. */
  async function act(path: string, body?: unknown, method: 'POST' | 'PATCH' = 'POST') {
    setBusy(true);
    setNotice('');
    const result = await apiRequest<unknown>(method, path, body);
    setBusy(false);
    if (!result.ok) {
      const message = Array.isArray(result.message) ? result.message.join(' ') : String(result.message);
      setNotice(message);
      // Surface the reason inline rather than reloading into a silent no-op.
      if (result.status === 401) { setAccess({ kind: 'signed_out', message }); return; }
      if (result.status === 403) { setAccess({ kind: 'not_staff', email: user?.email ?? '', role: user?.role ?? 'member' }); return; }
      return;
    }
    setNotice('Saved.');
    await load();
  }

  function switchTab(next: Tab) {
    setTab(next);
    setItems([]);
    // A channel filter belongs to the visit where it was chosen.
    if (next !== 'Song imports') setDraftArtistId(null);
  }

  if (!user || access.kind !== 'ready') {
    return <AccessPanel state={access} onRetry={() => { setAccess({ kind: 'checking' }); void load(); }} />;
  }

  return (
    <section>
      <p className="eyebrow">{user.role} workspace</p>
      <h1>Review &amp; catalogue</h1>
      <p className="muted">Changes to lyrics and catalogue visibility are recorded in the audit log.</p>

      <nav aria-label="Admin sections" style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', margin: '1rem 0' }}>
        {visibleTabs.map((name) => (
          <button
            key={name}
            type="button"
            className="btn btn--sm"
            aria-pressed={tab === name}
            onClick={() => switchTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      {notice ? <p role="status" className="muted">{notice}</p> : null}

      {tab === 'Overview' ? <OverviewPanel counts={overview} /> : null}

      {tab === 'Lyrics review' ? (
        <LyricsReviewPanel
          status={lyricsStatus}
          onStatusChange={(next) => { setLyricsStatus(next); setItems([]); }}
          items={items as LyricsReviewItem[]}
          busy={busy}
          act={act}
        />
      ) : null}

      {tab === 'Artist suggestions' ? (
        <ArtistSuggestionPanel items={items as ArtistSuggestionItem[]} act={act} />
      ) : null}

      {tab === 'Artists & sync' ? (
        <ArtistsPanel
          items={items as AdminArtistItem[]}
          busy={busy}
          act={act}
          onReviewDrafts={(artistId) => { setDraftArtistId(artistId); switchTab('Song imports'); }}
        />
      ) : null}

      {tab === 'Song imports' ? (
        <SongImportsPanel items={items as SongDraftItem[]} busy={busy} act={act} artistId={draftArtistId} onClearArtist={() => setDraftArtistId(null)} />
      ) : null}

      {tab === 'Audit' ? <AuditPanel items={items as AuditLogItem[]} /> : null}

      {tab === 'Users & roles' ? <UsersPanel items={items as AdminUser[]} act={act} /> : null}

      {!items.length && tab !== 'Overview' && tab !== 'Artists & sync' ? (
        <p className="muted">Nothing to review here yet.</p>
      ) : null}
    </section>
  );
}

/**
 * The screen shown when the dashboard cannot open, and WHY.
 *
 * Each case links to the one action that actually fixes it. Nothing here
 * redirects automatically: a redirect loop between /admin and /sign-in — the
 * usual result of "is this user staff?" being answered by a bounce — makes the
 * browser look broken and gives no clue which of the three cases happened.
 */
function AccessPanel({ state, onRetry }: { state: AccessState; onRetry: () => void }) {
  if (state.kind === 'checking') {
    return <section><h1>Staff dashboard</h1><p className="muted">Checking your session…</p></section>;
  }
  if (state.kind === 'signed_out') {
    return (
      <section>
        <h1>Staff dashboard</h1>
        <p role="alert" className="player-shell__error">{state.message}</p>
        <p>
          <a className="btn btn--primary" href="/sign-in?next=/admin">Sign in</a>{' '}
          <button type="button" className="btn" onClick={onRetry}>Try again</button>
        </p>
        <p className="muted">
          Staff are the accounts created by the seed (<code>SEED_ADMIN_EMAIL</code>) or promoted from
          {' '}<em>Users &amp; roles</em>. A normal sign-up is a member account and cannot open this area.
        </p>
      </section>
    );
  }
  if (state.kind === 'not_staff') {
    return (
      <section>
        <h1>Staff dashboard</h1>
        <p role="alert" className="player-shell__error">
          {state.email ? <><strong>{state.email}</strong> is signed in as <strong>{state.role}</strong>.</> : 'This account is not staff.'}{' '}
          Only admin and moderator accounts can open the staff dashboard.
        </p>
        <p>
          <a className="btn btn--primary" href="/sign-in?next=/admin">Sign in with a staff account</a>{' '}
          <a className="btn" href="/account">Go to my account</a>{' '}
          <button type="button" className="btn" onClick={onRetry}>Check again</button>
        </p>
        <p className="muted">
          An admin can promote this account from <em>Users &amp; roles</em>, or the seed promotes the
          account whose email matches <code>SEED_ADMIN_EMAIL</code>.
        </p>
      </section>
    );
  }
  return (
    <section>
      <h1>Staff dashboard</h1>
      <p role="alert" className="player-shell__error">
        {state.kind === 'unreachable' ? state.message : 'Could not check your session.'}
      </p>
      <p className="muted">The web app could not reach the API. Start it with <code>npm run dev:stack</code> and reload.</p>
      <button type="button" className="btn btn--primary" onClick={onRetry}>Retry</button>
    </section>
  );
}

/** Shared action signature, so each panel takes the same writer. */
type Act = (path: string, body?: unknown, method?: 'POST' | 'PATCH') => Promise<void>;

function OverviewPanel({ counts }: { counts: OverviewCounts | null }) {
  if (!counts) return null;
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
      {Object.entries(counts).map(([key, value]) => (
        <article key={key} className="panel">
          <strong>{String(value)}</strong>
          <p className="muted">{key.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`)}</p>
        </article>
      ))}
    </div>
  );
}

function LyricsReviewPanel({
  status,
  onStatusChange,
  items,
  busy,
  act,
}: {
  status: string;
  onStatusChange: (next: string) => void;
  items: LyricsReviewItem[];
  busy: boolean;
  act: Act;
}) {
  const save = (id: string, markdown: string, annotations: Annotation[]) =>
    void act(`/api/admin/lyrics/${id}`, { markdown, annotations }, 'PATCH');
  const approve = (id: string, annotations: Annotation[]) =>
    void act(`/api/admin/lyrics/${id}/approve`, { annotations });
  const reject = (id: string) => {
    const reason = window.prompt('Reason for rejection');
    if (reason) void act(`/api/admin/lyrics/${id}/reject`, { reason });
  };
  const requestChanges = (id: string) => {
    const note = window.prompt('What should the contributor change?');
    if (note) void act(`/api/admin/lyrics/${id}/request-changes`, { note });
  };

  return (
    <>
      <label>Submission status
        <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="pending">Pending</option>
          <option value="changes_requested">Changes requested</option>
          <option value="published">Published</option>
        </select>
      </label>
      <div style={{ display: 'grid', gap: '1rem', marginTop: '.75rem' }}>
        {items.map((item) => (
          <LyricsReviewCard
            key={item.id}
            item={item}
            busy={busy}
            onSave={(markdown, annotations) => save(item.id, markdown, annotations)}
            onApprove={(annotations) => approve(item.id, annotations)}
            onReject={() => reject(item.id)}
            onRequestChanges={() => requestChanges(item.id)}
          />
        ))}
      </div>
    </>
  );
}

function ArtistSuggestionPanel({ items, act }: { items: ArtistSuggestionItem[]; act: Act }) {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {items.map((item) => (
        <article key={item.id} className="panel">
          <h2>{item.suggestedName || item.channelTitle}</h2>
          <p>{item.channelTitle} · YouTube channel <code>{item.youtubeChannelId}</code></p>
          <p className="muted">
            {item.submitter?.displayName ?? 'Guest suggestion'} · {item.sampleVideos.length} sample uploads
          </p>
          <p>{item.channelDescription}</p>
          <ul>
            {item.sampleVideos.map((video) => (
              <li key={video.videoId}>
                <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noreferrer">
                  {video.title}
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void act(`/api/admin/artist-suggestions/${item.id}/approve`)}
          >
            Approve artist &amp; import drafts
          </button>{' '}
          <button
            type="button"
            className="btn"
            onClick={() => {
              const reason = window.prompt('Reason');
              if (reason) void act(`/api/admin/artist-suggestions/${item.id}/reject`, { reason });
            }}
          >
            Reject
          </button>
        </article>
      ))}
    </div>
  );
}

/**
 * Acquisition: add an artist by YouTube link, then import their catalogue.
 *
 * The stated flow is "paste one link, the whole channel appears", so the form
 * is a single field. The preview step exists because the interesting failures
 * — @handle that YouTube will not resolve, a link to a video that is gone, a
 * channel with no public uploads — are worth catching before a long import
 * starts and before an artist row exists to clean up.
 */
function ArtistsPanel({ items, busy, act, onReviewDrafts }: {
  items: AdminArtistItem[];
  busy: boolean;
  act: Act;
  onReviewDrafts: (artistId: string) => void;
}) {
  const [status, setStatus] = useState<AcquisitionStatus | null>(null);
  const [preview, setPreview] = useState<ChannelPreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [result, setResult] = useState<AddArtistResponse | null>(null);
  const [working, setWorking] = useState('');

  useEffect(() => {
    void apiRequest<AcquisitionStatus>('GET', '/api/admin/acquisition')
      .then((r) => { if (r.ok) setStatus(r.data); });
  }, []);

  const channel = () => (document.getElementById('acquire-channel') as HTMLInputElement | null)?.value ?? '';
  const catalogueName = () => (document.getElementById('acquire-name') as HTMLInputElement | null)?.value.trim() ?? '';

  async function run(importAll: boolean) {
    const link = channel().trim();
    if (!link) { setPreviewError('Paste a YouTube channel or video link first.'); return; }
    setWorking(importAll ? 'Importing every upload…' : 'Reading channel and importing catalogue…');
    setPreviewError('');
    setResult(null);
    // One request: resolve, create the artist and import. A 400-video channel
    // can take a while, so the button reports what is happening.
    const response = await apiRequest<AddArtistResponse>('POST', '/api/admin/artists', {
      youtubeChannel: link,
      ...(catalogueName() ? { name: catalogueName() } : {}),
      ...(importAll ? { importAll: true } : {}),
    });
    setWorking('');
    if (!response.ok) {
      setPreviewError(Array.isArray(response.message) ? response.message.join(' ') : response.message);
      return;
    }
    setResult(response.data);
  }

  async function doPreview() {
    const link = channel().trim();
    if (!link) return;
    setWorking('Checking the link…');
    setPreviewError('');
    setPreview(null);
    const response = await apiRequest<ChannelPreview>('POST', '/api/admin/acquisition/preview', { youtubeChannel: link });
    setWorking('');
    if (!response.ok) { setPreviewError(Array.isArray(response.message) ? response.message.join(' ') : response.message); return; }
    setPreview(response.data);
  }

  async function sync(artistId: string, options: { importAll?: boolean; restart?: boolean } = {}) {
    setWorking(options.importAll ? 'Importing every upload…' : 'Syncing the whole channel…');
    // `act` reloads the list, which is what refreshes the per-channel counts.
    await act(`/api/admin/artists/${artistId}/sync`, options);
    setWorking('');
  }

  return (
    <>
      {status && !status.configured ? (
        <div className="panel" role="alert" style={{ borderColor: '#b45309' }}>
          <h2>YouTube is not connected yet</h2>
          <p>Importing a catalogue needs a free YouTube Data API key. Until then the form below can only tell you why it will not work.</p>
          {status.setup ? <p className="muted">{status.setup}</p> : null}
        </div>
      ) : null}

      <form
        className="panel"
        style={{ display: 'grid', gap: '.35rem', justifyItems: 'start' }}
        onSubmit={(event) => { event.preventDefault(); void run(false); }}
      >
        <h2>Add an artist from YouTube</h2>
        <p className="muted">
          Paste the artist&apos;s channel link (<code>@handle</code>, <code>/channel/UC…</code>) or any one of their
          videos. The whole channel is read and every music upload becomes a draft song here.
        </p>
        <label htmlFor="acquire-channel" style={{ width: '100%' }}>YouTube link
          <input id="acquire-channel" name="channel" required placeholder="https://www.youtube.com/@artist or a video link" />
        </label>
        <label htmlFor="acquire-name" style={{ width: '100%' }}>Catalogue name (optional — defaults to the channel name)
          <input id="acquire-name" name="name" maxLength={100} />
        </label>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => void doPreview()} disabled={!!working}>Check the link</button>
          <button type="submit" className="btn btn--primary" disabled={!!working}>
            {working || 'Add artist & import catalogue'}
          </button>
        </div>
        {previewError ? <p role="alert" className="player-shell__error">{previewError}</p> : null}
      </form>

      {preview ? (
        <article className="panel" style={{ marginTop: '1rem' }}>
          <h2>{preview.title}</h2>
          <p className="muted">Channel <code>{preview.channelId}</code> · newest uploads:</p>
          <ul>
            {preview.sampleVideos.slice(0, 5).map((video) => (
              <li key={video.videoId}>
                <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noreferrer">{video.title}</a>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {result ? <ImportResult result={result} onImportAll={() => void run(true)} busy={!!working} /> : null}

      <h2 style={{ marginTop: '1.5rem' }}>Channels</h2>
      <div style={{ display: 'grid', gap: '.75rem' }}>
        {items.map((item) => {
          const syncState = item.youtubeSync;
          return (
            <article className="panel" key={item.id}>
              <strong>{item.name}</strong>
              <p className="muted">
                {item.importedPublished} published · {item.importedDrafts} drafts ·{' '}
                {syncState?.lastSyncAt ? `last sync ${new Date(syncState.lastSyncAt).toLocaleString()}` : 'never synced'}
                {syncState && !syncState.initialImportComplete ? ' · import still in progress' : ''}
              </p>
              {syncState?.lastError ? <p className="player-shell__error">{syncState.lastError}</p> : null}
              <ChannelVideos artistId={item.id} />
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn--primary" disabled={busy || !!working} onClick={() => void sync(item.id)}>
                  {syncState?.pausedByFilter ? 'Resume import' : 'Sync whole channel'}
                </button>
                {syncState?.pausedByFilter ? (
                  <button type="button" className="btn" disabled={busy || !!working} onClick={() => void sync(item.id, { importAll: true })}>
                    Import every upload
                  </button>
                ) : null}
                {syncState?.initialImportComplete ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !!working}
                    title="Walk the channel again from the newest upload. Safe to repeat: songs are matched by video id."
                    onClick={() => void sync(item.id, { restart: true })}
                  >
                    Re-check whole channel
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn"
                  onClick={() => onReviewDrafts(item.id)}
                >
                  Review {item.importedDrafts} drafts
                </button>
              </div>
            </article>
          );
        })}
        {!items.length ? <p className="muted">No channels yet — add the first artist above.</p> : null}
      </div>
    </>
  );
}

/**
 * Everything the app holds for one artist: drafts and published songs.
 *
 * "The whole catalogue shows up in the application" has to be visible, not
 * implied — this is where an admin checks that it did.
 */
function ChannelVideos({ artistId }: { artistId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SongDraftItem[] | null>(null);

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (items) return;
    const result = await apiRequest<SongDraftItem[]>('GET', `/api/admin/songs/drafts?artistId=${encodeURIComponent(artistId)}`);
    setItems(result.ok ? toItems<SongDraftItem>(result.data) : []);
  }

  return (
    <div style={{ margin: '.5rem 0' }}>
      <button type="button" className="btn btn--sm" aria-expanded={open} onClick={() => void toggle()}>
        {open ? 'Hide videos' : 'See videos in the app'}
      </button>
      {open && items === null ? <p className="muted">Loading…</p> : null}
      {open && items?.length ? (
        <ul style={{ maxHeight: 260, overflowY: 'auto', marginTop: '.5rem' }}>
          {items.map((song) => (
            <li key={song.id}>
              {song.title}{' '}
              <span className="muted">
                · {song.status} · {song.releaseDate ?? 'no date'}
                {song.youtubeImportKind ? ` · ${song.youtubeImportKind}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {open && items && !items.length ? <p className="muted">No drafts left — everything imported here is published.</p> : null}
    </div>
  );
}

/** What the import just did, in the terms an admin cares about. */
function ImportResult({ result, onImportAll, busy }: { result: AddArtistResponse; onImportAll: () => void; busy: boolean }) {
  const sync = result.sync;
  if (result.alreadyExists) {
    return (
      <article className="panel" style={{ marginTop: '1rem' }}>
        <h2>{result.artist.name} is already in the catalogue</h2>
        <p className="muted">
          {result.summary?.published ?? 0} published · {result.summary?.drafts ?? 0} drafts.{' '}
          Use <em>Sync whole channel</em> below to pick up new uploads.
        </p>
      </article>
    );
  }
  if (!sync) {
    return (
      <article className="panel" style={{ marginTop: '1rem' }}>
        <h2>{result.artist.name} was added</h2>
        <p className="muted">This channel was already in the catalogue; nothing was re-imported.</p>
      </article>
    );
  }
  return (
    <article className="panel" style={{ marginTop: '1rem' }}>
      <h2>{result.artist.name}: imported</h2>
      <ul>
        <li><strong>{sync.created}</strong> new songs, <strong>{sync.updated}</strong> already catalogued</li>
        <li>{sync.scanned} uploads read · {sync.skipped} skipped as not music (shorts, live, teasers)</li>
        <li>{sync.drafts} drafts waiting in <em>Song imports</em> · {sync.published} in the public catalogue</li>
      </ul>
      {sync.error ? (
        <p role="alert" className="player-shell__error">
          The import stopped early: {sync.error}.{' '}
          {sync.created || sync.updated
            ? 'The songs read before it stopped are saved.'
            : 'Nothing was imported.'}{' '}
          Press <em>Sync whole channel</em> to continue from where it stopped.
        </p>
      ) : null}
      {sync.complete ? null : <p className="muted">The walk through the channel is not finished; press <em>Sync whole channel</em> to continue.</p>}
      {sync.complete && sync.scanned && !sync.created && !sync.updated ? (
        <p className="muted">
          Nothing new: every song on the channel was already in the catalogue, and every other upload
          was ruled out as not music. Use <em>Import every upload</em> to override that.
        </p>
      ) : null}
      {sync.pausedReason ? (
        <div>
          <p role="alert" className="player-shell__error">{sync.pausedReason}</p>
          <button type="button" className="btn" disabled={busy} onClick={onImportAll}>Import every upload anyway</button>
        </div>
      ) : null}
    </article>
  );
}

function SongImportsPanel({ items, busy, act, artistId, onClearArtist }: {
  items: SongDraftItem[];
  busy: boolean;
  act: Act;
  artistId: string | null;
  onClearArtist: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '.75rem' }}>
      {artistId ? (
        <p className="muted">
          Showing one channel&apos;s imports.{' '}
          <button type="button" className="btn btn--sm" onClick={onClearArtist}>Show all channels</button>
        </p>
      ) : null}
      {items.map((item) => (
        <article className="panel" key={item.id}>
          <h2>{item.title}</h2>
          <p>
            {item.artists.map((entry) => entry.artist.name).join(', ')} · {item.status} ·{' '}
            {item.releaseDate ?? 'no release date'} ·{' '}
            <a href={`https://youtube.com/watch?v=${item.youtubeVideoId}`} target="_blank" rel="noreferrer">
              Preview on YouTube
            </a>
          </p>
          <p className="muted">
            {item.youtubeImportKind ? `Classified as ${item.youtubeImportKind}` : 'Channel import'}
            {item.youtubeImportReason ? ` — ${item.youtubeImportReason}` : ''}. Publish only after confirming this upload is a relevant song.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => void act(`/api/admin/songs/${item.id}/publish`)}
          >
            Publish song
          </button>
        </article>
      ))}
    </div>
  );
}

function AuditPanel({ items }: { items: AuditLogItem[] }) {
  return (
    <div style={{ display: 'grid', gap: '.5rem' }}>
      {items.map((item) => (
        <article className="panel" key={item.id}>
          <strong>{item.action}</strong>
          <p>
            {item.entity} · {item.entityId} · {item.actor?.displayName ?? 'system'} ·{' '}
            {new Date(item.createdAt).toLocaleString()}
          </p>
          <pre>{JSON.stringify(item.meta, null, 2)}</pre>
        </article>
      ))}
    </div>
  );
}

function UsersPanel({ items, act }: { items: AdminUser[]; act: Act }) {
  return (
    <div style={{ display: 'grid', gap: '.5rem' }}>
      {items.map((item) => (
        <article className="panel" key={item.id}>
          <strong>{item.displayName}</strong>
          <p>{item.email} · {item.role}</p>
          <label style={{ display: 'block' }}>Change role
            <select
              defaultValue={item.role}
              onChange={(event) => void act(`/api/admin/users/${item.id}/role`, { role: event.target.value }, 'PATCH')}
            >
              <option value="member">Member</option>
              <option value="contributor">Contributor</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </article>
      ))}
    </div>
  );
}
