# DrillKe — Product

> **One line:** the home of Kenyan drill — read the bars while the music plays.
>
> **Tagline:** _One track at a time._

This is the product specification. It says what we are building and what we are
deliberately **not** building yet. The long-form brief that inspired it lives in
[`context.md`](./context.md); where the two disagree, this file wins.

---

## 1. The problem

Kenyan drill is growing faster than the places that can explain it.

- Songs live on YouTube. Fans find them, but cannot follow what is being said —
  lyrics are missing, wrong, or scattered across comment sections and TikTok.
- Sheng, street slang and neighbourhood references are never explained, so a new
  listener misses the meaning entirely.
- Emerging artists have no profile beyond their channel; a fan who likes one
  song cannot find the rest of their catalogue in one place.
- The scene around the music — DJs, podcasts, events — is spread across
  Instagram, YouTube and group chats with no single index.

Every existing lyrics site solves this globally and generically. None of them
treat **Kenyan drill as a first-class scene**.

## 2. What DrillKe is

A web app where a fan opens a song, the video plays from its original source,
and the lyrics highlight line by line — with the slang and references explained
inline. Around that player sit the artist, the DJs who play them, the podcasts
that discuss them, and the events where they perform.

**DrillKe is not a streaming service.** Music plays from YouTube. We store
metadata, timing and commentary — never media we do not have rights to.

## 3. Product principles

1. **The player is the product.** Every v1 decision serves the
   play-plus-lyrics experience. If it does not make the bars easier to follow,
   it waits.
2. **Metadata, not media.** Embed and credit; never rehost.
3. **Artists keep their platforms.** We send listeners back to the artist.
4. **Honest interfaces.** Never imply lyrics are synced, or an artist is
   verified, when they are not.
5. **Community-built, editorially reviewed.** Anyone can contribute; nothing is
   published without review.
6. **Lightweight by design.** Everyday Android phones on mobile data are the
   target device.
7. **One source of truth.** Postgres is authoritative. Markdown import/export
   exists for bulk authoring, but import only ever creates *pending* submissions
   — it is a way into review, never a way around it.

---

## 4. V1 scope — the market-entry release

V1 is built to answer one question: **does anyone come back to DrillKe to
understand a song?**

To answer it quickly, v1 ships a complete, honest product with a small surface —
not a preview of everything. The rule used to cut scope:

> If a feature does not help a first-time visitor **find a song, play it, follow
> the lyrics, or come back tomorrow**, it is not in v1.

### 4.1 In v1

| # | Capability | What the user gets |
|---|---|---|
| 1 | **Synchronized player** | YouTube embed + lyrics that highlight and auto-scroll, click a line to seek. Graceful "unsynced" state. |
| 2 | **Annotations** | Tap a reviewed phrase attached to a lyric line to read its explanation. Moderators author them in the admin review queue, anchored to a reviewed line and validated with `resolveAnnotations`, then publish them with the lyric version. |
| 3 | **Song pages** | `/songs/[slug]` — server-rendered, SEO-ready, shareable. |
| 4 | **Artist pages** | `/artists/[slug]` — bio, links, catalogue, verification badge. |
| 5 | **Catalogue + search** | Browse songs and artists; search published songs by title, artist or lyric phrase, plus artists, DJs, podcasts and events. |
| 6 | **Lyrics contribution** | Submit plain text or a Markdown file anonymously or with an account; moderators review, add line timings against the YouTube clock, and publish versioned lyrics. The contributor is notified of the outcome when the submission is tied to an account. |
| 7 | **DJs** | `DJ` as a first-class role: directory, DJ profile, the songs they spin. |
| 8 | **Drill podcasts** | Episode index referencing external video/audio, with linked artist + song. |
| 9 | **Drill events** | Upcoming events with venue, date, lineup (artists + DJs) and ticket link. |
| 10 | **About / Support / Developers** | `/about`, `/support` and `/developers` explain the project, ways to help, and how developers can contribute to the open-source codebase. |
| 11 | **Accounts** | Passport Local email/password, JWT sessions, account page and roles (`member`, `contributor`, `moderator`, `admin`). Password reset by emailed single-use link, email confirmation, data export, and self-service deletion. |
| 12 | **Artist intake** | Guest channel suggestions, YouTube API verification, staff review and draft upload imports. |
| 13 | **Admin workspace** | Lyrics queue, artist suggestions, song draft review, role management and audit log. |

Lyrics can be submitted without an account. Signed-in contributors can keep a
submission history and opt into public credit when a submission is published.
Public recognition is not a promise of payment. Songs and video remain on
YouTube; uploaded channel videos start as private catalogue drafts until a
human confirms they are drill tracks.

### 4.2 Deliberately out of v1

These are tracked in [`roadmap.md`](./roadmap.md). Naming them here is the point:
scope discipline is the release strategy.

| Deferred | Why |
|---|---|
| **Marketplace / merch** | Payments, payouts, disputes, tax and fulfillment are an operations business, not a player feature. Ships as **storefront links** only (see §5). |
| **Competitions, challenges, voting** | Needs an anti-abuse and audit model before it is worth building. |
| **User playlists** | Nice-to-have next to the player; no retention signal yet. |
| **Native checkout / M-Pesa** | Requires a commission and payout model that does not exist yet. |
| **Drill Radio** | Licensing-heavy; cannot ship without rights. |
| **Word-level karaoke highlighting** | Line-level sync first; word-level is a polish pass. |
| **Shorts / vertical feed** | Second surface. Prove the catalogue first. |
| **Swahili/Sheng UI strings** | English UI in v1; content itself is multilingual. |

### 4.3 V1 success criteria

V1 is "shipped" when all of these hold:

- [ ] ≥ 50 approved songs across ≥ 20 artists, ≥ 40 of them synchronized.
- [ ] A song page reaches interactive playback in < 2.5 s on a mid-range Android
      device over 4G (p75).
- [ ] ≥ 60% of first-time song-page visitors press play.
- [ ] ≥ 25% return within 7 days.
- [ ] Median contribution-to-review turnaround < 72 hours.
- [ ] Zero unpublished/draft content reachable by search engines.

---

## 5. Feature notes

### 5.1 The player (`apps/web/app/components/player`)

- One persistent player mounted in the root layout; navigation between songs
  never reloads the page.
- The player owns the clock through the YouTube IFrame Player API. The lyrics
  view reads that clock and re-renders the active line as playback advances or
  the listener scrubs in YouTube's controls.
- The video is lazy — the YouTube iframe loads after a song is selected, with
  autoplay off so listening starts from a clear user action.
- `aria-current="true"` marks the active line; auto-scroll is user-disableable.
- The catalogue can start a queued track and the same iframe loads the next
  queued track when playback ends. This is a best-effort handoff; it is not an
  audio crossfade and YouTube buffering can still create a gap.
- The transport deck exposes seek/progress, elapsed and total time, play/pause,
  previous/restart, next, shuffle, repeat off/all/one, volume/mute, playback
  speed, and a selectable queue. Space toggles playback; left/right seek ten
  seconds; up/down adjust volume; N/P change tracks. Shortcuts never intercept
  typing or focused controls.
- Listen/Watch is a per-song preference. Both modes use the same visible,
  interactive YouTube player; Listen gives the lyrics more room. The queue and
  player controls do not extract or separately stream audio.
- Synchronized lyric highlighting follows the YouTube clock. Listeners can
  click a line to seek and turn automatic lyric scrolling off.
- Two lyric states only: `unsynchronized` (readable, no timing) and
  `synchronized` (timed). A synced song that fails to parse degrades to
  unsynchronized and says so.

YouTube remains the media host and controls owner. DrillKe does not layer two
videos to fade their audio, extract audio, hide standard player controls, or
continue playback in a hidden/background player. A crossfade or guaranteed
gapless handoff would require a separately licensed audio source and a distinct
product decision.

### 5.2 Locale content — artists, DJs, podcasts, events

These are four views over one idea: *the scene around the music*. They share an
identity model (`Artist`, `Dj`) so a DJ who is also a producer appears once.

| Surface | Route | Core fields |
|---|---|---|
| Artist | `/artists/[slug]` | name, bio, links, channel id, verification, songs |
| DJ | `/djs`, `/djs/[slug]` | name, bio, mix links, songs they spin, event appearances |
| Podcast | `/podcasts`, `/podcasts/[slug]` | show, host(s), episode list, episode → artist/song links |
| Event | `/events`, `/events/[slug]` | title, venue, city, start time, lineup, ticket url |

Rules that keep these cheap to run:

- **No media is hosted.** Episode audio/video and event pages are external links
  or embeds. We store metadata and attribution only.
- **DJs do not upload mixes.** They link to SoundCloud/Mixcloud/YouTube, the same
  way artists link to a channel.
- **Events are informational.** We never take payment for a ticket in v1 —
  the ticket link goes to the organiser.

### 5.3 Contribution & review

```text
member submits  →  validated server-side  →  pending
                                              │
                                  reviewer: approve / request changes / reject
                                              │
                                        new LyricVersion (immutable once approved)
                                              │
                                       published → indexed
```

- Lyrics are **versioned**: approving an edit creates a new version rather than
  mutating the old one, so rollback is just "publish version N-1".
- The submission body is plain text or a Markdown document, stored as submitted
  and parsed server-side into timed or untimed lines (see `lyrics-format.md`).
  Raw HTML is rendered as text in either form.
- Bulk authoring runs through `npm run content:import` / `content:export`. Import
  only ever creates **pending** submissions, so Git is never a path to
  publication without review.
- Review outcomes are emailed to account-linked contributors. The default
  provider is a mock that logs instead of sending, so no contributor receives
  mail until a real transport (`MAIL_PROVIDER=smtp`) is configured.
- **Password reset** sends a single-use link valid for an hour. The request is
  indistinguishable from an unknown address, so it cannot be used to discover
  which emails have accounts. Resetting revokes every session.
- **Email confirmation** is sent on sign-up but is a soft gate: an unconfirmed
  account browses and submits normally. The account page prompts while it is
  unconfirmed, and a resend is one click.
- **Account deletion** is password-confirmed and audited. Pending submissions are
  withdrawn; published lyrics stay in the catalogue, because they are the
  catalogue. `product.md` §5.4 (rights) allows that byline to be removed on
  request.
- **Data export** downloads one JSON file from the account page. Passwords and
  security tokens are never in it.
- Moderators can play the linked YouTube source, stamp each line from the
  shared player clock, adjust timestamps, and save the pending submission. A
  separate approval publishes it; every line must be timed for sync status.
- Every review action is written to `AuditLog`.

### 5.4 Rights

Lyrics are copyrighted works. V1 rules:

- An artist/rights-holder-submitted version is published with an explicit grant.
- Community-submitted lyrics are held under the platform's rights policy and may
  be published as annotations/commentary only until rights clear.
- A rights-holder request unpublishes first and asks questions later.
- The code licence never covers lyrics, artwork or artist names.

---

## 6. Users & roles

| Role | Can |
|---|---|
| `member` | Browse, search, play, read lyrics and annotations, submit lyrics |
| `contributor` | Everything a member can, plus a contribution history and badges |
| `moderator` | Review, approve, request changes, reject, unpublish, resolve reports |
| `admin` | Everything, plus roles, artists/DJs/podcasts/events, audit log |

Artist and DJ pages are **not** accounts in v1. They are catalogue entities,
claimed later (roadmap). This avoids building onboarding, verification and
organisations before there is demand.

## 7. Non-goals & constraints

- **No native apps** in v1. The web app must work as a home-screen install
  (manifest + safe areas) so the upgrade path is a PWA, not a rewrite.
- **No audio hosting** of any kind until licensing exists.
- **No ads** in v1; growth and support come from `/support`.
- **No bespoke CMS.** Reviewers use `/admin`; Markdown import/export remains a
  planned content workflow rather than a current feature.

## 8. Open questions

Each of these must be closed before the phase that depends on it:

1. Storefront links only in v1, or wait for v2? *(decision: links only)*
2. Who reviews lyrics at launch — founder-only, or a founding moderator panel?
3. Do we require rights clearance before publishing community lyrics, or publish
   with a takedown-first policy?
4. Which events source seeds the calendar — manual entry only, or a partner feed?

## 9. Metrics we collect

Deliberately minimal: page and player events only, no cross-site tracking, no PII
in analytics. See [`architecture.md`](./architecture.md) §9.
