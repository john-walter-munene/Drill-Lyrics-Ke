# DrillKe — API contract

Base URL: `{NEXT_PUBLIC_API_URL}` — every route is prefixed `/api`.
Content type: `application/json`. The lyric submission's `markdown` field
currently carries plain lyric text for backwards-compatible storage.

This document is the contract the web app uses. Public listening and lyric
submission work without an account. Accounts use Passport Local and JWT-backed
sessions; staff routes check roles server-side.

---

## Conventions

**Success** returns the resource, or a page envelope:

```json
{ "items": [], "total": 0, "page": 1, "pageSize": 20, "totalPages": 1 }
```

**Errors** always use one envelope (`AllExceptionsFilter`):

```json
{
  "statusCode": 422,
  "error": "UnprocessableEntity",
  "message": ["timestamps must be non-decreasing"],
  "path": "/api/lyrics/submissions",
  "timestamp": "2026-10-20T09:00:00.000Z"
}
```

**Auth** uses Passport Local for email/password and a signed JWT in an HttpOnly,
SameSite=Lax cookie. API clients may use a Bearer token. Active sessions roll
forward; 14 days without activity expires the server-side session and JWT.

**Rate limits** are per IP: global 120/min, auth 20/min, writes 30/min
(env-configurable). `429` responses carry `Retry-After`.

**Caching:** public reads may be cached by the web app for the `revalidate` hint
shown; `admin`, `auth`, `lyrics/submissions` are never cached.

---

## Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | — | Liveness only; never touches the DB |
| GET | `/api/health/ready` | — | `200` ok / `503` when the DB is unreachable |

## Auth

| Method | Path | Auth | Body / Query |
|---|---|---|---|
| POST | `/api/auth/signup` | — | `{ email, password, displayName }` |
| POST | `/api/auth/signin` | — | `{ email, password }` |
| POST | `/api/auth/signout` | member | — |
| GET | `/api/auth/me` | member | → `Me` |
| POST | `/api/auth/forgot-password` | — | `{ email }` → `{ accepted: true }` |
| GET | `/api/auth/reset-password/:token` | — | → `{ valid: boolean }` |
| POST | `/api/auth/reset-password` | — | `{ token, password }` → `{ ok: true }` |
| POST | `/api/auth/delete-account` | member | `{ password }` → `{ ok: true }` |
| GET | `/api/auth/confirmation` | member | → `{ verified, email, verifiedAt }` |
| POST | `/api/auth/confirmation/resend` | member | → `{ accepted: true, sent: boolean }` |
| POST | `/api/auth/confirm-email` | — | `{ token }` → `{ ok, status }` |
| GET | `/api/auth/export` | member | → account data as JSON |

Password and deletion routes use the strict auth throttle (20 req/min/IP).

**`forgot-password` never reveals whether an account exists.** It returns
`{ accepted: true }` for any well-formed address, real or not, and the mail is
only sent when an account matches. Rate limiting is the defence against using it
as a mail-bomb.

**`reset-password` is single-use and revokes every session.** The token is 256
bits, stored only as SHA-256, valid for 60 minutes. A second
`forgot-password` invalidates every outstanding link for that user. Errors:
- `400` — invalid, expired, already used, or a password under 10 characters.
  The same message is used for all four so a holder of a stolen token learns
  nothing from the distinction.
- The successful response clears the session cookie, because the tokens that
  backed it were deleted.

**Email confirmation is a soft gate.** Sign-up always succeeds and the account
is usable immediately; the confirmation link is sent for the contributor's
benefit, not as verification. `confirm-email` is idempotent: a second click
returns `{ ok: true, status: 'already_confirmed' }` rather than an error.
`resend` answers `accepted` whatever happens, so it cannot be used to probe
whether an address is verified.

**`export` never contains credentials.** The document has `account` (no
`passwordHash`), `lyricSubmissions`, `reportsFiled` and `activeSessions`. Token
hashes are excluded for the same reason.

**`delete-account` requires the current password.** `401` on a wrong password or
a missing session. It removes the account, its sessions, reset tokens and
non-published submissions; published contributions are kept with
`userId = null`. Recorded as `account.deleted` in the audit log.

```ts
type Me = {
  id: string;
  email: string;
  displayName: string;
  role: 'member' | 'contributor' | 'moderator' | 'admin';
  createdAt: string;
};
```

## Artists

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/artists?q=&page=` | — | Directory, published only |
| GET | `/api/artists/:slug` | — | Profile + links + song count |
| GET | `/api/artists/:slug/songs?page=` | — | Published songs, newest first |

```ts
type Artist = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  imageUrl: string | null;
  youtubeChannelId: string | null;
  verified: boolean;
  links: { label: string; url: string }[];
  songCount: number;
};
```

## Songs & lyrics

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/songs?q=&artist=&status=&page=` | — | Catalogue browse |
| GET | `/api/songs/feeds` | — | Home shelves: `{ newSongs, syncedSongs, emergingArtists }` |
| GET | `/api/songs/:slug` | — | Playback metadata |
| GET | `/api/songs/:slug/lyrics` | — | **One payload per song** |

```ts
type Song = {
  id: string;
  slug: string;
  title: string;
  artists: { slug: string; name: string }[];
  featuring: { slug: string; name: string }[];
  youtubeVideoId: string;
  language: 'sheng' | 'swahili' | 'english' | 'mixed';
  releaseDate: string | null;      // YYYY-MM-DD
  durationMs: number | null;
  status: 'draft' | 'pending' | 'published' | 'unpublished';
  lyrics: { syncStatus: 'unsynchronized' | 'synchronized'; versionId: string | null };
};
```

`GET /api/songs/:slug/lyrics` → the payload defined in
[`lyrics-format.md`](./lyrics-format.md) §3. Returns `404` when the song has no
published version — the player then renders the "lyrics coming soon" state.

## Lyrics submissions (writes)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/lyrics/submissions` | — | `{ songId, markdown, note?, creditPublicly? }`; anonymous or account-linked |
| GET | `/api/lyrics/submissions/mine` | member | Caller's submissions + status |
| GET | `/api/lyrics/submissions/:id` | owner | One of the caller's submissions |

```json
{
  "songId": "clx…",
  "markdown": "[00:12.500] …",
  "creditPublicly": false
}
```

The submission form selects a published catalogue song and sends either one
lyric line per text row or a full Markdown document (`lyrics-format.md` §1).
Timestamps are optional; when present, use `[mm:ss.mmm]` or `[hh:mm:ss.mmm]` at
the start of a row. The `songId` is always authoritative — a Markdown document's
frontmatter cannot create or change a song.

The server validates with `parseLyricsDocument` when the body looks like a
Markdown document (a leading `---` fence), and with `parseLyricsText` otherwise.
It then stores the raw text against the selected song with status `pending`.
Guest submissions stay anonymous. A signed-in submitter may opt into public
credit; only published, opted-in submissions appear in contributor recognition.
This recognition makes no promise of payment.

Every review outcome notifies an account-linked submitter (`MailService`). A
guest submission has no stored address and is skipped; the audit log records
`lyrics.notification_skipped` with the reason.

Responses: `201` → `{ id, status: 'pending' }`; `404` → song is not published;
`422` → invalid or empty lyrics, with per-field errors for a Markdown document
(`frontmatter`, `title`, `youtubeVideoId`, `lyrics`, `annotations`).

**Statuses:** `draft` · `pending` · `changes_requested` · `approved` ·
`published` · `rejected` · `unpublished`.

## Review (moderator+)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/admin/lyrics/queue?status=pending` | moderator | Review queue; `status=published` returns published submissions for timing corrections |
| PATCH | `/api/admin/lyrics/:id` | moderator | `{ markdown, annotations? }`; edits pending text/timestamps, or creates a new immutable version for published edits; audited. Omitting `annotations` keeps the published version's annotations; sending `[]` clears them |
| POST | `/api/admin/lyrics/:id/approve` | moderator | `{ annotations? }`; creates a published `LyricVersion` with the reviewed annotations |
| POST | `/api/admin/lyrics/:id/reject` | moderator | `{ reason }` required |
| POST | `/api/admin/lyrics/:id/request-changes` | moderator | `{ note }` |
| POST | `/api/admin/lyrics/:id/unpublish` | admin | `{ reason }`; rights requests land here |
| GET | `/api/admin/audit?entity=&page=` | admin | Audit log |

The admin review editor can load a song in the shared YouTube player and stamp
each line with the player's current position. It serializes those values as
`[mm:ss.mmm]` and validates line ordering with the shared parser. Pending edits
are saved to the submission; a moderator must still approve them. Editing a
published submission creates a new published `LyricVersion`, retires the prior
version, updates `Song.syncedVersionId`, and records the change in the audit
log. All lines need valid timestamps for the version to be marked synchronized.

## Search

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/search?q=&types=song,artist,dj,podcast,event` | — | Min 2 chars; returns up to 8 results per requested type |

```ts
type SearchResults = {
  query: string;
  songs: SearchHead[];
  artists: SearchHead[];
  djs: SearchHead[];
  podcasts: SearchHead[];
  events: SearchHead[];
};
type SearchHead = { slug: string; title: string; subtitle: string | null; imageUrl: string | null };
```

Omit `types` to search all five types. Search is case-insensitive substring
matching: songs match title, credited artist name, or text in a published lyric
version; other entities match their public names and descriptive fields. Draft,
pending and unpublished songs/lyrics are excluded. Queries shorter than two
characters return empty result arrays; input is trimmed and limited to 100
characters.

Results are **ranked** within each type (`modules/search/relevance.ts`), highest
first:

| Tier | Example for `masicka` | Score |
|---|---|---|
| exact title/name | `Masicka` | 100 |
| title starts with the query | `Masicka Update` | 80 |
| a word in the title starts with it | `The Masicka Tape` | 60 |
| the title contains it mid-word | `Xmasicka Remix` | 40 |
| only a secondary field matches (lyrics, bio, venue, host) | a song whose lyric mentions it | 10 |

Ties keep the database's own order (newest release, then name), so identical
requests return identical lists. Matching itself is still `ILIKE`: there is no
typo tolerance yet, and no trigram index.

## DJs

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/djs?city=&page=` | — | Directory |
| GET | `/api/djs/:slug` | — | Bio, mix links, tracks spun |

```ts
type Dj = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  imageUrl: string | null;
  city: string | null;
  links: { label: string; url: string }[];
  tracks: { slug: string; title: string; artist: string }[];
};
```

## Podcasts

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/podcasts?page=` | — | Shows |
| GET | `/api/podcasts/:slug` | — | Show + episodes |
| GET | `/api/podcasts/:slug/episodes/:number` | — | Episode + linked songs/artists |

```ts
type Podcast = {
  id: string; slug: string; title: string; description: string | null;
  hostName: string | null; imageUrl: string | null; episodeCount: number;
};
type PodcastEpisode = {
  id: string; number: number; title: string;
  publishedAt: string; durationMs: number | null;
  externalUrl: string;                       // YouTube / Spotify / etc.
  platform: 'youtube' | 'spotify' | 'anchor' | 'other';
  songs: { slug: string; title: string }[];
  artists: { slug: string; name: string }[];
};
```

## Events

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/events?from=&city=&page=` | — | Upcoming first |
| GET | `/api/events/:slug` | — | Detail + lineup |

```ts
type DrillEvent = {
  id: string; slug: string; title: string;
  description: string | null;
  venue: string | null; city: string;
  startsAt: string; endsAt: string | null;
  ticketUrl: string | null; ticketPrice: string | null;
  imageUrl: string | null;
  lineup: {
    artists: { slug: string; name: string }[];
    djs: { slug: string; name: string }[];
  };
};
```

> Buying a ticket is **always** an outbound link in v1. No payment endpoint
> exists, and none should be added without a product decision (see
> [`product.md`](./product.md) §4.2).

## Authentication and account

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | — | `{ email, password, displayName }`; creates a member and signs in |
| POST | `/api/auth/signin` | — | Passport Local; `{ email, password }` |
| POST | `/api/auth/signout` | optional | Revokes the current session and clears cookie |
| GET | `/api/auth/me` | member | Current user; JWT cookie or Bearer token |
| POST | `/api/auth/forgot-password` | — | Always `{ accepted: true }`; see §Auth |
| GET | `/api/auth/reset-password/:token` | — | `{ valid }` — check before showing the form |
| POST | `/api/auth/reset-password` | — | `{ token, password }`; revokes all sessions |
| POST | `/api/auth/delete-account` | member | `{ password }`; irreversible |
| GET | `/api/auth/confirmation` | member | `{ verified, email, verifiedAt }` |
| POST | `/api/auth/confirmation/resend` | member | Idempotent; always `accepted` |
| POST | `/api/auth/confirm-email` | — | `{ token }`; idempotent, returns `already_confirmed` |
| GET | `/api/auth/export` | member | Account, submissions, reports, sessions — no hashes |
| GET | `/api/lyrics/submissions/mine` | member | Current user's submissions and review state |
| GET | `/api/lyrics/submissions/:id` | member | Own submission only |
| GET | `/api/lyrics/contributors/top` | — | Publicly credited published submissions only |

Browser login uses an HttpOnly, SameSite=Lax `drillke_session` cookie. API
clients may send the signed JWT as a Bearer token. The server revokes a session
on sign-out and enforces rolling 14-day inactivity expiration; active sessions
receive a renewed 14-day JWT before it is within a day of expiry (in the
`Authorization` response header for Bearer clients). Set a strong
`JWT_SECRET` (at least 32 characters) in production. Public listening, search,
and lyrics submission never require sign-in. Contributor recognition is
opt-in and makes no promise of payment.

## Artist channel intake

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/artists/suggestions` | — | `{ youtubeChannel, suggestedName? }`; resolves and queues a review item |
| GET | `/api/admin/artist-suggestions` | moderator | Pending candidates with sample uploads |
| POST | `/api/admin/artist-suggestions/:id/approve` | moderator | Creates artist and imports draft song candidates |
| POST | `/api/admin/artist-suggestions/:id/reject` | moderator | `{ reason }` |
| POST | `/api/admin/artists` | moderator | `{ youtubeChannel, name?, importAll? }`; adds the artist and imports the whole channel. An already-known channel returns `{ alreadyExists: true, sync: null, summary }` — not an error |
| GET | `/api/admin/artists` | moderator | Artists with sync state and imported draft/published counts |
| POST | `/api/admin/artists/:id/sync` | moderator | `{ importAll?, restart? }`; walks the WHOLE channel (or resumes it). Returns `SyncResult`; `409` when a sync for this artist is already running |
| GET | `/api/admin/acquisition` | moderator | `{ configured, setup?, artistsWithChannel, importedDrafts, importedPublished }` |
| POST | `/api/admin/acquisition/preview` | moderator | `{ youtubeChannel }`; resolves a link without creating anything |
| GET | `/api/admin/songs/drafts` | moderator | Imported draft/pending candidates, optionally `?artistId=` |
| POST | `/api/admin/songs/:id/publish` | moderator | Publishes a reviewed song candidate |

### Acquisition

One link is all an admin supplies. Accepted input: `@handle`, bare handle,
`youtube.com/@handle`, `/channel/UC…`, legacy `/c/…` and `/user/…`, **or any
video link** (`watch?v=`, `youtu.be/`, `/shorts/`, `/live/`) — a video resolves
to the channel that owns it.

`POST /api/admin/artists` resolves the channel and then walks its uploads
playlist to the last page (`pagesPerArtistPerCycle` no longer applies to an
explicit sync). The walk is bounded by `pageInfo.totalResults`, the channel's own
upload count, and YouTube metadata is fetched in batches of up to 50 ids per
`videos.list` call. Per upload:

- **rejected** — YouTube Shorts, live/upcoming streams, anything under 30s.
  Never imported, even with `importAll`;
- **audio / video** — imported as a `draft` song with `youtubeImportKind` and
  `youtubeImportReason`, credited to the artist as primary;
- **unclear or a non-Music category** — imported as a **review candidate** (the
  same `draft` row, `youtubeImportKind: "unclear"`), counted in `skipped`, and
  never published on its own. `UNCLEAR_PAUSE_THRESHOLD` such uploads in a row
  pause the walk (`YoutubeChannelSync.pausedByFilter`); `{ "importAll": true }`
  overrides the pause for that request.

The walk saves its position after **every page**. A failure part-way (quota,
network) keeps what was imported and is reported on the result rather than
thrown; the next sync resumes from the failed page.

Songs are keyed by `Song.youtubeVideoId` (unique), so re-running a sync is
idempotent and a video linked from a second artist adds a feature credit rather
than a duplicate row. `SyncResult` reports `{ pages?, pagesThisPass?, scanned,
created, updated, skipped, drafts, published, complete, pausedReason, error? }`.
`complete` is true only when the final page was reached; `error` is set when the
pass stopped early. One sync per artist may run at a time: a second call while
one is in flight returns `409 This channel is already being imported`.
`{ "restart": true }` begins the walk again from the newest upload (used to
re-check a channel whose earlier import finished before it imported anything).
Uploads stay drafts until a human publishes them; playback remains a YouTube
embed.

## Administration

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/admin/overview` | moderator | Catalogue and review queue counts |
| GET | `/api/admin/lyrics/queue` | moderator | Pending submissions, oldest first |
| PATCH | `/api/admin/lyrics/:id` | moderator | Saves edited lyric text/timestamps and `annotations` before approval. Each annotation needs `phrase`, `explanation` and (optionally) `lineIndex`; `resolveAnnotations` rejects a phrase that is not on its line with `409` |
| POST | `/api/admin/lyrics/:id/approve` | moderator | Parses and publishes an immutable lyric version with its annotations |
| POST | `/api/admin/lyrics/:id/sync-estimate` | moderator | `audio/wav` body only; runs the shared line-sync estimator on the submission's lines and returns suggested `startsMs` with `confidence`/`coverage`. The admin editor currently estimates in the browser instead |
| POST | `/api/admin/lyrics/:id/reject` | moderator | `{ reason }` |
| POST | `/api/admin/lyrics/:id/request-changes` | moderator | `{ note }` |
| POST | `/api/admin/lyrics/:id/unpublish` | admin | Removes public lyrics; retains review record |
| GET | `/api/admin/audit` | admin | Paginated privileged-action log |
| GET | `/api/admin/users` | admin | Staff account list for role administration |
| PATCH | `/api/admin/users/:id/role` | admin | `{ role }`; cannot demote the last admin |

## Reports

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/reports` | member | `{ targetType, targetId, reason, detail? }` → `{ id, status, duplicate }` |

`targetType` ∈ `song` · `lyric_version` · `annotation` · `artist` · `dj` ·
`podcast_episode` · `event` · `user`.

Responses: `201` on a new report; `201` with `duplicate: true` when an open report
already exists for that target (the extra report is appended to its detail rather
than stored as a second row); `404` when no entity matches `targetId`. A report
never changes publication state — a moderator acts on it in the admin queue.

## Sitemap

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/sitemap` | — | `{ path, updatedAt }[]` for `sitemap.ts` |
