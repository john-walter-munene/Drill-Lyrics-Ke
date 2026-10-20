# DrillKe — API contract

Base URL: `{NEXT_PUBLIC_API_URL}` — every route is prefixed `/api`.
Content type: `application/json` (submissions also accept Markdown text).

This document is the contract the web app is built against. Handlers are stubbed
in this scaffold; the **shapes below are the ones to implement**.

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

**Auth** is a session cookie (`httpOnly`, `SameSite=Lax`). Mutating routes that
require an account return `401` when absent and `403` when the role is too low.

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
| POST | `/api/lyrics/submissions` | member | Markdown body; validation per `lyrics-format.md` |
| GET | `/api/lyrics/submissions/mine` | member | Caller's submissions + status |
| GET | `/api/lyrics/submissions/:id` | owner / moderator | One submission |

```json
{
  "songId": "clx…",
  "markdown": "---\ntitle: …\n---\n\n[00:12.500] …"
}
```

Responses: `201` → `{ id, status: 'pending' }`; `422` → field errors.

**Statuses:** `draft` · `pending` · `changes_requested` · `approved` ·
`published` · `rejected` · `unpublished`.

## Review (moderator+)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/admin/lyrics/queue?status=pending` | moderator | Review queue |
| POST | `/api/admin/lyrics/:id/approve` | moderator | Creates a published `LyricVersion` |
| POST | `/api/admin/lyrics/:id/reject` | moderator | `{ reason }` required |
| POST | `/api/admin/lyrics/:id/request-changes` | moderator | `{ note }` |
| POST | `/api/admin/lyrics/:id/unpublish` | admin | `{ reason }`; rights requests land here |
| GET | `/api/admin/audit?entity=&page=` | admin | Audit log |

## Search

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/search?q=&types=song,artist,dj,podcast,event` | — | Min 2 chars |

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

## Reports

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/reports` | member | `{ targetType, targetId, reason, detail? }` |

`targetType` ∈ `song` · `lyric_version` · `annotation` · `artist` · `dj` ·
`podcast_episode` · `event` · `user`.

## Admin (misc)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/admin/artists` · `/djs` · `/podcasts` · `/events` | admin | Create/update catalogue entries |
| PATCH | `/api/admin/users/:id/role` | admin | `{ role }` |
| POST | `/api/admin/youtube/sync` | admin | Trigger a metadata import run |

## Sitemap

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/sitemap` | — | `{ path, updatedAt }[]` for `sitemap.ts` |
