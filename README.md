# DrillKe 🇰🇪

### The home of Kenyan drill. One track at a time.

[![License: MIT](https://img.shields.io/badge/code-MIT-green.svg)](#license)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![Status](https://img.shields.io/badge/status-pre--MVP-orange.svg)](#development-roadmap)
[![Built with Next.js](https://img.shields.io/badge/built%20with-Next.js-black.svg)](https://nextjs.org)

**DrillKe is an open-source music discovery and lyrics platform built around Kenyan drill.** It helps fans understand the bars, discover emerging artists, explore the culture, and take part in the community around the music.

Inspired by synchronized-lyrics experiences like Musixmatch and the seamless playback feel of local media players like PotPlayer, DrillKe combines synchronized lyrics, YouTube playback, artist discovery, community playlists, competitions, and culture-driven content in one lightweight web app.

> **Artists keep their existing platforms. Fans get a better way to experience the music. The community helps build the library.**

Our goal is simple: **make Kenyan drill easier to discover, understand, experience, and support.**

---

## Table of Contents

- [Vision](#vision)
- [The Problem](#the-problem)
- [What We're Building](#what-were-building)
- [Core Features](#core-features)
- [The Lyrics Experience](#the-lyrics-experience)
- [How Lyrics Enter the Platform](#how-lyrics-enter-the-platform)
- [Music Playback](#music-playback)
- [Artist Discovery](#artist-discovery)
- [Playlists and Competitions](#playlists-and-competitions)
- [Drill TV and Short-Form Content](#drill-tv-and-short-form-content)
- [Drill Culture and Community](#drill-culture-and-community)
- [Artist Profiles and Merchandise](#artist-profiles-and-merchandise)
- [Open-Source Philosophy](#open-source-philosophy)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [SEO and Discoverability](#seo-and-discoverability)
- [Cost-Conscious Infrastructure](#cost-conscious-infrastructure)
- [Security and Content Moderation](#security-and-content-moderation)
- [Copyright and Content Rights](#copyright-and-content-rights)
- [Privacy and Data Protection](#privacy-and-data-protection)
- [Accessibility and Performance](#accessibility-and-performance)
- [Development Roadmap](#development-roadmap)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Governance and Community Conduct](#governance-and-community-conduct)
- [Project Principles](#project-principles)
- [FAQ](#faq)
- [Acknowledgements](#acknowledgements)
- [License](#license)

---

## Vision

Kenyan drill is more than music. It is sound, language, identity, stories, neighbourhoods, creativity, and community.

Yet discovering an artist, understanding their lyrics, finding their other releases, following their journey, and joining the culture often means hopping between several disconnected platforms.

DrillKe connects these experiences without forcing artists or listeners to abandon the platforms they already use.

We want to build a place where someone can:

1. Discover an unfamiliar Kenyan drill artist.
2. Open a song and follow its lyrics as the music plays.
3. Understand Sheng, slang, references, and the stories behind the bars.
4. Explore the artist's other releases and YouTube channel.
5. Discover community-curated playlists.
6. Take part in playlist competitions and drill challenges.
7. Watch interviews, podcasts, commentary, and Shorts.
8. Support artists by discovering and buying their merchandise.

Over time, DrillKe can grow beyond Kenya to support drill scenes across Africa and beyond.

**We start with Kenyan drill, build for the community, and expand when the foundation is ready.**

---

## The Problem

Music discovery is easy to start but hard to experience deeply.

- Listeners find songs on YouTube without being able to follow what is being said. Lyrics may be missing, inaccurate, hard to follow, or disconnected from the music.
- Sheng, slang, and local references are rarely explained, so new listeners miss the meaning.
- Emerging artists struggle to reach listeners beyond their existing social audiences.
- Fans discover releases, debate artists, make playlists, and follow commentary across many different platforms.

DrillKe brings these experiences together around a focused starting point: **the music and its lyrics**.

### Our approach

| Principle | What it means |
| --- | --- |
| **Understand the bars** | Synchronize lyrics with playback and explain the language. |
| **Discover the scene** | Make artists, songs, and releases searchable. |
| **Participate in the culture** | Playlists, voting, challenges, and community stories. |
| **Support artists** | Discovery pages and an optional merchandise marketplace. |
| **Keep it accessible** | A lightweight web experience that works on everyday devices and connections. |

---

## What We're Building

DrillKe is a modular music and culture platform. Its foundation is a searchable catalogue connected to a synchronized lyrics player. Every other feature builds on that foundation instead of living as a disconnected product.

| Area | Purpose |
| --- | --- |
| **Lyrics and Player** | Synchronized lyrics, music playback, and song pages |
| **Music Discovery** | Search, artist profiles, releases, and discovery feeds |
| **Community** | Contributions, playlists, competitions, voting, and challenges |
| **Drill TV** | Podcasts, interviews, commentary, and short-form video |
| **Artist Support** | Artist profiles, merchandise, and creator storefronts |
| **Drill Radio** | A future continuous-listening experience built around the scene |

These areas do not launch at once. The first release establishes a reliable catalogue, an excellent lyrics experience, and a sustainable contribution workflow.

---

## Core Features

### 1. Synchronized Lyrics Player

The heart of DrillKe.

- Lyrics displayed alongside an embedded music video.
- Current line highlighted as the song plays.
- Auto-scroll to upcoming lines, keeping the active line visible without manual scrolling.
- Click a lyric line to seek to its timestamp (where the player supports it).
- Support for manually timed, line-by-line synchronized lyrics.
- Annotations explaining Sheng, slang, cultural references, and wordplay.
- Clean interface optimized for mobile and desktop.
- Persistent playback controls with minimal interruptions.

### 2. Searchable Music Catalogue

Every approved song gets its own public page.

- Search by song title or artist.
- Browse by release, artist, or collection.
- Navigate from a song to its artist and related releases.
- Search-engine-friendly URLs.
- Relevant metadata and available lyrics.
- Links to the original music source.

### 3. Community-Powered Lyrics

Members contribute through a simple submission flow backed by Markdown.

- Submit new lyrics or suggest new song entries.
- Correct transcription mistakes.
- Add timestamps.
- Provide explanations and annotations.
- Suggest edits to existing lyrics.
- Track review and publication status.
- Administrator approval required before publication.

The workflow should make it easy for people who understand the language and culture to improve the catalogue.

### 4. Artist Discovery

- Artist profile pages.
- Links to official YouTube channels.
- Approved song and video listings.
- Biographies and social links.
- Featured and emerging artist collections.
- Community-curated discovery playlists.

### 5. Playlists and Competitions

- Create, publish, and share playlists.
- Add eligible catalogue entries.
- Organize playlist competitions with voting.
- Display standings and results.
- Run themed community challenges.

### 6. Drill TV

A dedicated home for drill-related video: interviews, podcasts, commentators, artist conversations, music discussions, reactions, and Shorts. Videos stay hosted on their original platforms and are embedded on DrillKe where possible.

### 7. Artist Merchandise

An optional way for artists to sell merchandise.

- Artist storefronts and product listings.
- Product images and descriptions.
- Purchase links or checkout.
- Order tracking where supported.
- A transparent platform commission.

The proposed commission is **10% of eligible merchandise sales** made through DrillKe. Payments, refunds, disputes, fulfillment, and payouts need a clearly defined operational and technical model before this feature launches.

### 8. Drill Challenges and Culture

- Community freestyle and themed drill challenges.
- User-submitted entries with clear participation rules.
- Voting and competition results.
- Artist spotlights, personal stories, events, and announcements.

### 9. Drill Radio *(future)*

A listening mode for continuous discovery: curated streams, artist-focused sessions, themed selections, emerging-artist rotations, and community playlists.

Radio must respect music licensing and playback rights. It will not rebroadcast protected music without the necessary permissions.

---

## The Lyrics Experience

Synchronized lyrics are the main reason to use DrillKe. The experience should feel immediate, readable, and connected to the music.

### Playback behaviour

When a user opens an eligible song page:

1. The page loads song metadata, approved lyrics, and available annotations.
2. The music video (or supported audio source) becomes available.
3. The user presses Play, subject to the embedded player's requirements.
4. The current lyric line is highlighted.
5. Lyrics scroll vertically as playback progresses.
6. The next line becomes active at its assigned timestamp.
7. The user can pause, resume, or seek when the provider supports it.

The interface must not reload the page or fetch every lyric line separately.

### Lyrics file format

Lyrics are stored in a structured, human-editable format. A Markdown file contains frontmatter for song metadata, followed by timestamped lyrics and annotations.

```markdown
---
title: "Example Track"
artist: "Example Artist"
youtubeVideoId: "YOUTUBE_VIDEO_ID"
language: "sheng"
status: "draft"
---

# Lyrics

[00:12.500] First line of the verse.
[00:15.200] Second line of the verse.
[00:18.100] Third line of the verse.

## Annotations

- **Selected phrase:** Explanation of its meaning or cultural context.
```

> The example above is illustrative and does not represent an actual song.

The application parses Markdown into a **validated internal representation** before rendering.

**Markdown is the authoring format, not the playback engine.** The player consumes structured lyric lines and timestamps.

```ts
type LyricLine = {
  startMs: number;          // timestamp in milliseconds
  endMs?: number;           // derived from the next line when omitted
  text: string;
};

type Annotation = {
  phrase: string;
  explanation: string;
  lineIndex?: number;
};

type ParsedLyrics = {
  syncStatus: "unsynchronized" | "synchronized";
  lines: LyricLine[];
  annotations: Annotation[];
};
```

### Timing accuracy

Timestamped lyrics provide the initial timing. For precise synchronization, the player should:

- Read the embedded player's current playback time.
- Identify the active lyric line (binary search over sorted timestamps).
- Update the highlighted line only when playback crosses a timestamp.
- Scroll only when necessary.
- Avoid expensive re-rendering on every playback tick.
- Handle pausing, seeking, buffering, and replaying correctly.

A lightweight client-side timing loop is preferred over continuous backend requests.

### Unsynchronized lyrics

Not every contribution arrives with timestamps. DrillKe supports two states:

- **Unsynchronized:** lyrics are available to read, but line timing has not been completed.
- **Synchronized:** approved timestamps are available to the player.

The interface must never imply lyrics are synchronized when they are not.

### Future improvements

Once the basic player is reliable:

- Word-level highlighting.
- Richer annotation support.
- Better timestamp editing tools (tap-to-sync editor).
- User-adjustable scrolling.
- Keyboard shortcuts.
- Optional synchronized translations or explanations.

These are enhancements, not prerequisites for the first release.

---

## How Lyrics Enter the Platform

DrillKe combines open community contribution with editorial review.

```text
Community Contributor
        |
        v
Submit Lyrics (web form or Markdown)
        |
        v
Validation
        |
        v
Pending Review
        |
        v
Administrator Review
        |
        +--------------------+
        |                    |
        v                    v
     Rejected             Approved
        |                    |
        v                    v
 Feedback to          Published Song Page
 contributor                 |
                             v
                    Search Engine Indexing
```

### Contribution model

Contributors can:

- Submit lyrics for an existing song or suggest a new song entry.
- Add timestamps to approved lyrics.
- Submit corrections.
- Add cultural explanations and annotations.
- Improve metadata.

### Review model

Administrators can:

- Review pending submissions and preview formatted lyrics.
- Check timestamp formatting.
- Edit metadata.
- Approve, reject, or request corrections.
- Unpublish content when necessary.
- Review proposed changes to already-published lyrics (with a diff view).

### Source of truth

Markdown is a convenient format, but contributors should not need to understand Git.

- The initial implementation accepts submissions through a **web form**, validates them on the backend, and stores them as **pending records**.
- Approved content can be exported to Markdown files in a version-controlled content directory.
- Alternatively, the repository could become the primary source, with approved Markdown imported into the database.

The project should choose **one** authoritative publishing workflow rather than maintaining two independent sources of truth.

**MVP decision:** a database-backed review workflow with Markdown import and export.

### Submission statuses

| Status | Meaning |
| --- | --- |
| `draft` | Being prepared by the contributor |
| `pending` | Submitted and awaiting review |
| `changes_requested` | Reviewer has asked for corrections |
| `approved` | Accepted, ready to publish |
| `published` | Live and indexable |
| `rejected` | Declined, with a reason |
| `unpublished` | Removed from public view (for example, after a rights request) |

---

## Music Playback

DrillKe makes music easy to experience without duplicating existing streaming infrastructure.

### YouTube integration

Official videos are embedded via the **YouTube IFrame Player API**. Where permitted, the player exposes play/pause, current time, seeking, playback state, and video metadata. These let the lyrics interface stay in sync.

The application must respect YouTube's playback requirements, branding, attribution, and API policies.

### Instant transitions

A major design goal is making song-to-song navigation feel immediate. The interface should:

- Keep the player mounted when navigating between eligible songs.
- Prefetch the next song's metadata, lyrics, and annotations.
- Preserve appropriate playback state during navigation.
- Avoid full-page reloads.
- Show a clear loading state when a new video must initialize.

Next.js client-side navigation with a persistent player layout provides a good foundation.

> Switching between YouTube videos cannot always be instantaneous. The player may need to initialize or buffer. The goal is to remove unnecessary *application* delays, not to promise that every external video starts without buffering.

### Audio support

The architecture may eventually support licensed audio sources alongside YouTube. Audio is only hosted or streamed when DrillKe has the rights and a suitable storage and delivery arrangement.

---

## Artist Discovery

Artists are discoverable without uploading their catalogue to DrillKe.

### Artist onboarding

1. An artist submits their name and official YouTube channel.
2. DrillKe verifies the channel association.
3. The platform retrieves eligible public video metadata through supported YouTube interfaces.
4. Videos are matched against existing catalogue entries.
5. Potential new songs enter a review or confirmation workflow.
6. Approved songs become discoverable on the artist's profile.

### Importing videos

DrillKe imports **metadata**, not video files. It normally stores:

- YouTube video ID, title, and thumbnail reference.
- Channel ID.
- Publication date (where available).
- Artist association.
- Catalogue review status.

The music stays on YouTube and plays through its supported embed. The platform uses the official YouTube Data API where appropriate, subject to quotas, policies, and permissions.

It must not assume that every video on a channel is a song, or that every public video is embeddable. Imports are checked for duplicates and classified before entering the public catalogue.

### Artist verification

Submitting a channel URL does **not** make a profile verified. Verification starts as a manual administrator process, with stronger workflows (for example, a verification code placed in the channel description, or Google account sign-in as the channel owner) introduced later.

---

## Playlists and Competitions

### Playlists

Users should eventually be able to create, edit, reorder, publish, keep private, and share playlists of eligible songs, and explore playlists made by others.

### Competition lifecycle

```text
Draft → Published → Voting Open → Voting Closed → Results Published
```

Each competition defines:

- Title, description, and organizer.
- Start and end dates.
- Eligible playlists.
- Voting rules and participation limits.
- Result calculation.
- Moderation rules.

### Voting integrity

- Voting is enforced on the **backend**.
- Duplicate votes are prevented according to the competition's published rules.
- Voting activity is stored in an auditable record.
- Rate limiting, account requirements, and further abuse prevention scale with the competition.
- The platform clearly states whether voting is public, account-restricted, or subject to other eligibility rules.

---

## Drill TV and Short-Form Content

Drill TV is the home for the conversations surrounding the music, featuring content from artists, podcasters, commentators, and interviewers.

### Categories

Podcasts · Artist interviews · Music commentary · Drill news and discussion · Reactions and reviews · Behind-the-scenes · Short-form video · Community and event coverage.

### Initial implementation

No video hosting infrastructure is needed at first. DrillKe stores video metadata and displays eligible YouTube embeds, organized into categories and curated collections.

### Shorts

Short-form content gets a mobile-friendly browsing experience: one video at a time, vertical layouts where appropriate, easy navigation between clips. Where the source platform supports an embed, DrillKe displays it while preserving the original creator's attribution.

DrillKe does **not** download, rehost, or modify other creators' videos without the necessary rights.

---

## Drill Culture and Community

DrillKe represents more than releases and streams. It gives the community room to tell its stories and celebrate the people behind the music.

Potential features:

- Artist interviews and profiles.
- Personal stories about discovering drill.
- Stories about the communities behind the music.
- Editorial spotlights.
- Community-submitted event announcements.
- Freestyle and themed lyrical challenges.
- Public voting and results.
- Emerging artist showcases.

### Challenges

A challenge is a community event with a title, description, organizer, start and end dates, submission rules, eligible formats, voting or judging rules, and published results.

The first implementation focuses on **simple, moderated challenges** rather than a complex event-management system.

---

## Artist Profiles and Merchandise

DrillKe helps artists turn discovery into support.

### Artist accounts

Artists may eventually:

- Claim an existing profile.
- Update their biography and links.
- Suggest edits to their catalogue.
- Submit releases for review.
- Manage merchandise listings.
- Review sales and order information.

Artist accounts are distinct from the public catalogue entries that represent their music.

### Merchandise marketplace

Artists can list clothing, accessories, and other eligible products.

| | Share of eligible merchandise sales |
| --- | --- |
| **Artist proceeds** | 90% |
| **DrillKe commission** | 10% |

This describes the intended platform commission, not necessarily the artist's final net proceeds. Payment processing fees, taxes, refunds, and other deductions must be defined transparently before launch.

### Keep the first version simple

The first merchandise release uses **artist storefronts with links to external checkout pages**. This validates demand without taking on a full payment and fulfillment system.

Native checkout, order management, commission calculation, and payouts come later, once operational requirements are understood. For Kenyan users this will likely mean evaluating M-Pesa-based payment options alongside card payments.

---

## Open-Source Philosophy

DrillKe is an open-source project. The community should be able to inspect, improve, and extend the software that powers the platform.

### What openness means

- A publicly available application codebase.
- A clear contribution process.
- Reusable lyrics parsing and validation logic.
- Documented API contracts.
- Community participation in improving the experience.
- Transparent technical decisions.
- A modular architecture with no unnecessary services.

### What openness does not mean

Open-source code does **not** grant permission to reproduce copyrighted lyrics, distribute protected music, use artist branding without authorization, or ignore third-party platform policies.

The code license, contribution terms, content permissions, and commercial platform policies are defined **separately**. Contributing code does not automatically grant permission to use a contributor's work in every commercial context; the contribution terms will say exactly what is granted.

---

## Technology Stack

A small, conventional stack that is easy to develop locally and affordable to deploy. Items marked *(proposed)* are recommendations to confirm during the MVP build.

### Frontend

| Technology | Responsibility |
| --- | --- |
| Next.js (App Router) | Web application, routing, rendering, and SEO |
| React | User interface and player components |
| TypeScript | Type safety |
| Tailwind CSS | Styling and responsive layouts |
| YouTube IFrame Player API | Embedded video playback and timing |
| Fetch API | Backend communication |
| Zod *(proposed)* | Schema validation for lyrics, forms, and API payloads |
| A small Markdown/frontmatter parser *(proposed, for example `gray-matter` plus `remark`)* | Lyrics and annotation parsing |

Additional libraries are introduced only when a specific feature requires them.

### Backend and data

| Technology | Responsibility |
| --- | --- |
| Next.js Route Handlers / Server Actions | API endpoints and server logic |
| PostgreSQL *(proposed)* | Primary database |
| Drizzle ORM or Prisma *(proposed)* | Typed database access and migrations |
| Auth.js *(proposed)* | Authentication (Google sign-in plus email) |
| YouTube Data API v3 | Channel and video metadata import |
| Object storage *(later, only when needed)* | Product images and other uploads |

### Tooling

| Technology | Responsibility |
| --- | --- |
| pnpm | Package management |
| ESLint and Prettier | Linting and formatting |
| Vitest | Unit tests (parser, timing logic) |
| Playwright | End-to-end tests |
| GitHub Actions | Continuous integration |

---

## Architecture

DrillKe starts as a **single deployable Next.js application** with a PostgreSQL database. There are no microservices and no separate backend until scale demands it.

```text
┌────────────────────────────────────────────────────────┐
│                        Browser                         │
│  ┌──────────────┐   ┌────────────────┐  ┌───────────┐  │
│  │ Persistent   │   │ Lyrics Engine  │  │ Search &  │  │
│  │ YouTube      │◄──┤ (timing loop,  │  │ Browse UI │  │
│  │ Player       │   │  active line)  │  │           │  │
│  └──────┬───────┘   └────────────────┘  └─────┬─────┘  │
└─────────┼─────────────────────────────────────┼────────┘
          │ IFrame API                          │ HTTPS
          ▼                                     ▼
   ┌─────────────┐              ┌─────────────────────────────┐
   │  YouTube    │              │        Next.js App          │
   │  (playback) │              │  Server Components / SSR    │
   └─────────────┘              │  Route Handlers (REST)      │
                                │  Auth · Validation · Rate   │
                                │  limiting · Moderation      │
                                └───────┬──────────────┬──────┘
                                        │              │
                                        ▼              ▼
                                ┌────────────┐  ┌──────────────┐
                                │ PostgreSQL │  │ YouTube Data │
                                │            │  │ API (import) │
                                └────────────┘  └──────────────┘
```

### Key design decisions

1. **Server-render public pages** (song, artist, playlist) for SEO and fast first paint. Hydrate only the interactive player.
2. **Persistent player layout.** The player lives in a layout that survives route changes, enabling instant transitions.
3. **Lyrics delivered as one payload per song**, a compact JSON array of `{startMs, text}`. No per-line requests.
4. **Client-side timing.** The lyrics engine polls the player time with `requestAnimationFrame` or a short interval, and re-renders only when the active line index changes.
5. **Validation at the boundary.** Every submission is parsed and validated on the server before it is stored.
6. **One source of truth.** The database is authoritative; Markdown is import/export.
7. **Metadata, not media.** DrillKe stores references to videos, never the videos themselves.
8. **Feature modules.** Each area (lyrics, playlists, competitions, Drill TV, merch) lives in its own module with clear boundaries so areas can ship independently.

---

## Data Model

A simplified conceptual model. The exact schema will evolve during implementation.

```text
User ──< Submission >── Song >── Artist
 │                        │         │
 │                        │         └── ArtistClaim (verification)
 │                        │
 │                        ├──< LyricVersion ──< LyricLine
 │                        │         └────────< Annotation
 │                        │
 │                        └──< PlaylistItem >── Playlist >── User
 │
 ├──< Vote >── CompetitionEntry >── Competition
 ├──< ChallengeEntry >── Challenge
 └──< Product >── Artist  (merch, later)

VideoContent (Drill TV) ── Category / Collection
AuditLog (moderation and voting actions)
```

### Main entities

| Entity | Notes |
| --- | --- |
| `users` | Accounts with roles: `member`, `contributor`, `moderator`, `admin`, `artist` |
| `artists` | Name, slug, bio, links, YouTube channel ID, verification status |
| `songs` | Title, slug, artist(s), YouTube video ID, release date, status |
| `lyric_versions` | Versioned lyrics per song, sync status, source, review status |
| `lyric_lines` | `version_id`, `index`, `start_ms`, `text` |
| `annotations` | Phrase, explanation, optional line reference |
| `submissions` | Contributor submissions with status, reviewer, and notes |
| `playlists` / `playlist_items` | User playlists with ordering and visibility |
| `competitions` / `competition_entries` / `votes` | Lifecycle, rules, and auditable votes |
| `challenges` / `challenge_entries` | Community challenges |
| `videos` | Drill TV metadata: platform, external ID, category, creator attribution |
| `products` | Merchandise listings (later) |
| `audit_logs` | Moderation actions, approvals, and vote events |

### Versioning

Lyrics are **versioned**. Approving an edit creates a new `lyric_version` rather than overwriting history, so changes can be reviewed, compared, and rolled back.

---

## SEO and Discoverability

Search visibility is a core growth channel for a lyrics platform.

- **Server-rendered** song, artist, and playlist pages.
- Clean, stable URLs such as `/songs/artist-name/song-title` and `/artists/artist-name`.
- Unique `<title>` and meta descriptions per page.
- `Open Graph` and Twitter card metadata for sharing.
- JSON-LD structured data (`MusicRecording`, `MusicGroup`, `BreadcrumbList`).
- Auto-generated `sitemap.xml` and `robots.txt`.
- Canonical URLs to avoid duplicate-content issues.
- Only **approved and published** pages are indexable.
- `noindex` for drafts, pending submissions, and unpublished content.
- Fast Core Web Vitals through lightweight pages and lazy-loaded embeds (facade pattern for YouTube iframes).
- Support for English and Sheng search terms.

---

## Cost-Conscious Infrastructure

DrillKe should run affordably, even for free, at the start.

| Concern | Approach |
| --- | --- |
| Hosting | Free or low-cost Next.js hosting (for example Vercel, Netlify, or Cloudflare) |
| Database | Managed PostgreSQL free tier (for example Neon or Supabase), upgraded on demand |
| Video | Never hosted; embedded from YouTube |
| Images | Reference YouTube thumbnails; optimize any uploads |
| Caching | Static generation and ISR for song pages; CDN caching for lyrics JSON |
| Search | Start with PostgreSQL full-text search and trigram matching; add a dedicated engine only if needed |
| YouTube API quota | Cache imports, batch requests, and schedule syncs |
| Background jobs | Scheduled functions or cron; no always-on workers initially |
| Monitoring | Basic uptime and error tracking on free tiers |

Principle: **do not add a paid service until a measured need justifies it.**

---

## Security and Content Moderation

### Application security

- Server-side validation of all input; never trust the client.
- Role-based access control for contributor, moderator, and admin actions.
- Parameterized queries via the ORM.
- Output sanitization for all user-submitted Markdown and HTML (no raw HTML rendering).
- CSRF protection and secure, HTTP-only session cookies.
- Rate limiting on submissions, searches, sign-ins, and votes.
- Secrets in environment variables, never in the repository.
- Dependency auditing and automated security updates.
- Strict Content Security Policy that permits only required embeds.
- Audit logs for approvals, unpublishing, role changes, and voting.

### Voting and anti-abuse

- Backend-enforced one-vote rules per competition.
- Account age or verification requirements where appropriate.
- Anomaly detection on suspicious voting patterns.
- Ability to invalidate votes with an audit trail.

### Content moderation

- All lyrics require administrator approval before publication.
- Report buttons on lyrics, annotations, playlists, and submissions.
- A moderation queue with clear status and reasons.
- Published community guidelines covering harassment, hate speech, doxxing, threats, and the glorification of real violence against identifiable people.
- Contributor reputation and role progression (trusted contributors can be fast-tracked later).
- Transparent appeal path for rejected submissions.

Drill music often involves strong language and difficult themes. DrillKe documents the content it hosts, applies clear, consistent rules, and distinguishes artistic expression from targeted harassment or threats.

---

## Copyright and Content Rights

This is the most important legal and operational area for a lyrics platform. **Open-sourcing the code does not change who owns the songs or lyrics.**

### Principles

- **Music stays with the source.** DrillKe embeds from YouTube and does not host or redistribute audio or video it lacks rights to.
- **Lyrics are copyrighted works** in most cases. Publishing full lyrics without permission can infringe the rights of the writers and publishers.
- **Artist-first licensing.** The preferred path is for artists (or their rights holders) to submit or approve lyrics for their own songs, granting DrillKe a clear license to display them.
- **Respect platform terms.** YouTube's Terms of Service and API policies must be followed, including embedding and attribution rules.
- **Attribution.** Credit artists, writers, and original creators.

### Recommended rights model

| Situation | Handling |
| --- | --- |
| Artist submits or approves their own lyrics | Published with a clear license grant |
| Community-submitted lyrics for a song | Held to the platform's rights policy; may require rights-holder permission or licensing before full display |
| No rights confirmed | Publish annotations, commentary, and metadata only; link to the source video |
| Rights-holder objection | Fast unpublish workflow (see below) |

> **Before public launch, obtain qualified legal advice** on Kenyan copyright law and the Copyright Act, and explore licensing arrangements with collecting societies such as MCSK, other relevant rights organizations, and lyrics-licensing providers. This README is a project description, not legal advice.

### Takedown process

- A visible contact point and a documented takedown request form.
- Prompt unpublishing while a claim is reviewed.
- Records of requests and outcomes.
- A policy for repeat infringers.

### Contribution terms

Contributors confirm they have the right to submit what they provide, and grant DrillKe the permissions needed to display it. The exact terms will be published in `CONTRIBUTING.md` and the site's Terms of Use.

---

## Privacy and Data Protection

- Collect only what is needed: email, display name, and activity tied to features the user uses.
- Comply with applicable law, including **Kenya's Data Protection Act, 2019**, and register with the Office of the Data Protection Commissioner where required.
- Publish a clear Privacy Policy and Terms of Use.
- Provide account deletion and data export.
- Avoid invasive tracking; prefer privacy-respecting analytics.
- Treat embedded YouTube content as third-party content subject to YouTube's own privacy practices. Consider privacy-enhanced embed mode.
- Special care for anyone under 18: age-appropriate defaults and a policy for content involving minors.

---

## Accessibility and Performance

### Accessibility

- Semantic HTML and keyboard-navigable controls.
- Visible focus states and sufficient color contrast.
- Screen-reader support: the active lyric line is exposed with `aria-current`, and auto-scroll can be turned off.
- Respect `prefers-reduced-motion`.
- Adjustable lyric text size.

### Performance budgets

DrillKe targets everyday phones on mobile data.

- Small JavaScript bundles; load the player lazily.
- Facade for YouTube iframes until interaction.
- Compressed lyrics payloads.
- Offline-friendly basics through a progressive web app (installable, cached shell) in a later phase.
- Core Web Vitals "good" thresholds on mid-range Android devices.

### Language and localization

- English UI first, with Swahili and Sheng UI strings considered after the MVP.
- Unicode-safe handling of lyrics across languages.
- Language tags on songs (`sheng`, `swahili`, `english`, `mixed`).

---

## Development Roadmap

Phases are goals, not promises, and may be re-ordered based on community feedback.

### Phase 0: Foundations

- [ ] Repository, license, code of conduct, and contribution guide
- [ ] Project scaffolding (Next.js, TypeScript, Tailwind, linting, CI)
- [ ] Database schema and migrations
- [ ] Lyrics format specification and parser with tests
- [ ] Legal groundwork: Terms, Privacy Policy, takedown process, rights model

### Phase 1: MVP (Lyrics and Catalogue)

- [ ] Persistent YouTube player with timing loop
- [ ] Synchronized lyrics view (highlight and auto-scroll)
- [ ] Click-to-seek on lyric lines
- [ ] Song and artist pages with SEO metadata
- [ ] Search by song and artist
- [ ] Authentication and roles
- [ ] Contribution form with validation
- [ ] Admin review queue (approve, reject, request changes)
- [ ] Markdown import and export
- [ ] Unsynchronized and synchronized states
- [ ] Basic annotations
- [ ] Sitemap, structured data, and performance pass

### Phase 2: Artists and Discovery

- [ ] Artist onboarding and manual verification
- [ ] YouTube channel metadata import
- [ ] Duplicate detection and classification
- [ ] Featured and emerging artist collections
- [ ] Timestamp editing tool for contributors
- [ ] Reporting and moderation improvements

### Phase 3: Community

- [ ] User playlists (public and private)
- [ ] Playlist competitions with voting and audit trail
- [ ] Moderated challenges
- [ ] Contributor reputation and profiles
- [ ] Notifications

### Phase 4: Drill TV

- [ ] Video metadata catalogue with YouTube embeds
- [ ] Categories and curated collections
- [ ] Mobile-first Shorts browsing

### Phase 5: Artist Support

- [ ] Artist accounts and profile claiming
- [ ] Merchandise storefronts with external checkout
- [ ] Transparent commission and payout model
- [ ] Evaluate native checkout (including M-Pesa)

### Phase 6: Expansion

- [ ] Drill Radio (subject to licensing)
- [ ] Word-level lyric highlighting
- [ ] Translations and Swahili/Sheng interface
- [ ] Progressive web app
- [ ] Public API
- [ ] Support for drill scenes beyond Kenya

---

## Repository Structure

A proposed layout:

```text
drillke/
├── app/                    # Next.js routes (App Router)
│   ├── (public)/           # Songs, artists, playlists, search
│   ├── (auth)/             # Sign-in and account
│   ├── admin/              # Moderation and review tools
│   └── api/                # Route handlers
├── components/             # Shared UI components
│   └── player/             # Persistent YouTube player and lyrics UI
├── lib/
│   ├── lyrics/             # Parser, validator, timing engine
│   ├── youtube/            # IFrame wrapper, Data API client
│   ├── db/                 # Schema, migrations, queries
│   ├── auth/               # Authentication and permissions
│   └── moderation/         # Rules, rate limiting, audit logging
├── content/                # Optional exported Markdown lyrics
├── docs/                   # Specs: lyrics format, API, rights policy
├── scripts/                # Import, export, and maintenance scripts
├── tests/                  # Unit and end-to-end tests
├── .github/                # Issue templates, workflows
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── LICENSE
└── README.md
```

---

## Getting Started

> The project is in early development. Commands below describe the intended workflow and will be finalized with the scaffolding.

### Prerequisites

- **Node.js** 20 or later
- **pnpm** 9 or later
- **PostgreSQL** 15 or later (local install or Docker)
- A **Google Cloud** project with the **YouTube Data API v3** enabled (needed only for channel import features)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/drillke.git
cd drillke

# 2. Install dependencies
pnpm install

# 3. Create your environment file
cp .env.example .env.local

# 4. Start a local database (Docker example)
docker run --name drillke-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=drillke -p 5432:5432 -d postgres:15

# 5. Run migrations and seed sample data
pnpm db:migrate
pnpm db:seed

# 6. Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Seed data** uses fictional songs and artists only. Do not commit real copyrighted lyrics to the repository.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values. **Never commit real secrets.**

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public base URL (for canonical links and sitemap) |
| `AUTH_SECRET` | Yes | Secret used to sign sessions |
| `AUTH_GOOGLE_ID` | Optional | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Optional | Google OAuth client secret |
| `YOUTUBE_API_KEY` | Optional | YouTube Data API key (artist and video import) |
| `ADMIN_EMAILS` | Yes (initially) | Comma-separated emails granted admin on first sign-in |
| `RATE_LIMIT_REDIS_URL` | Optional | Store for rate limiting at scale |
| `EMAIL_SERVER` / `EMAIL_FROM` | Optional | Transactional email settings |
| `NEXT_PUBLIC_ANALYTICS_ID` | Optional | Privacy-respecting analytics identifier |

Variables prefixed `NEXT_PUBLIC_` are exposed to the browser. Do not put secrets in them.

---

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format with Prettier |
| `pnpm typecheck` | Run the TypeScript compiler |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:seed` | Seed fictional sample data |
| `pnpm lyrics:validate <file>` | Validate a Markdown lyrics file |
| `pnpm lyrics:export` | Export approved lyrics to `content/` |
| `pnpm lyrics:import` | Import Markdown files from `content/` |

---

## Testing

- **Unit tests** for the lyrics parser: timestamp formats, malformed input, unsynchronized files, duplicate and out-of-order timestamps.
- **Timing engine tests**: active-line lookup, seeking backwards and forwards, pauses, and replay.
- **Integration tests** for submission, validation, and review flows.
- **End-to-end tests** (Playwright) for opening a song, playback sync, search, and the contribution flow.
- **Accessibility checks** in CI.
- Tests must use fictional or properly licensed content.

---

## Deployment

1. Provision a managed PostgreSQL database.
2. Configure environment variables on your host.
3. Run migrations (`pnpm db:migrate`) during deployment.
4. Deploy the Next.js application to your hosting platform.
5. Set up scheduled jobs for YouTube metadata sync (if enabled).
6. Confirm `sitemap.xml`, `robots.txt`, and canonical URLs.
7. Enable error monitoring and uptime checks.

Detailed, platform-specific guides will live in `docs/deployment/`.

---

## Contributing

DrillKe is built with and for the community. You do not need to be a developer to help.

### Ways to contribute

| If you are... | You can... |
| --- | --- |
| A fan who knows the language | Submit lyrics, timestamps, and Sheng/slang annotations |
| A listener | Report errors, suggest songs and artists, make playlists |
| An artist or rights holder | Claim your profile and submit or approve lyrics for your own songs |
| A designer | Improve the player UX, mobile layouts, and accessibility |
| A developer | Pick up issues labeled `good first issue` or `help wanted` |
| A writer or journalist | Contribute stories, interviews, and spotlights |
| A translator | Help localize the interface |

### Developer workflow

1. **Fork** the repository and create a branch: `feat/short-description` or `fix/short-description`.
2. **Discuss large changes first** by opening an issue.
3. **Write tests** for new behavior, especially parsing and timing logic.
4. **Run** `pnpm lint && pnpm typecheck && pnpm test` before opening a pull request.
5. **Open a pull request** describing the change, the motivation, and any screenshots.
6. Respond to review feedback. Maintainers aim to review promptly.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/), for example `feat(player): add click-to-seek` or `fix(parser): handle missing millis`.

### Lyrics contributions

- Only submit lyrics you have the right to share (see [Copyright and Content Rights](#copyright-and-content-rights)).
- Follow the lyrics format in [The Lyrics Experience](#the-lyrics-experience).
- Be accurate. Listen carefully and prefer the artist's own published lyrics when available.
- Keep annotations respectful, factual, and helpful.
- Do not use the contribution system to harass, dox, or threaten anyone.

### Code of Conduct

All participants are expected to follow the project's `CODE_OF_CONDUCT.md`. Be respectful, constructive, and welcoming.

### Reporting security issues

Please do **not** open public issues for vulnerabilities. Follow the process in `SECURITY.md` to report privately.

---

## Governance and Community Conduct

- **Maintainers** guide technical direction and review contributions.
- **Moderators** review lyrics and community content.
- **Decisions** that affect the community (rights policy, commission, moderation rules) are discussed publicly through RFC-style issues where practical.
- **Transparency reports** on takedowns and moderation actions are published periodically.
- **Artist voice:** artists can influence how their catalogue is presented, and have a clear path to correct, annotate, or remove content about their own work.

---

## Project Principles

1. **Music first.** Everything starts with the song and the experience of understanding it.
2. **Artists keep their platforms.** DrillKe sends listeners to artists; it does not replace them.
3. **Community-built, editorially reviewed.** Open contribution with human review.
4. **Rights matter.** Open-source code never excuses infringing content.
5. **Metadata, not media.** Reference, embed, and credit; do not rehost.
6. **Lightweight by design.** Fast on everyday phones and modest connections.
7. **Simple before complex.** Ship the smallest valuable version, then grow.
8. **One source of truth.** Avoid duplicated authority and hidden state.
9. **Transparent economics.** Clear commission and payout rules before any money moves.
10. **Honest interfaces.** Never imply lyrics are synced, or an artist verified, when they are not.
11. **Safe community.** Clear rules, fair moderation, and a real appeals path.
12. **Start local, grow outward.** Kenyan drill first; other scenes when the foundation is ready.

---

## FAQ

**Is DrillKe a streaming service?**
No. Music plays from its original source (currently YouTube). DrillKe adds lyrics, context, discovery, and community around it.

**Do artists need to upload their music?**
No. Artists keep their existing channels. DrillKe references and embeds their public videos.

**Can I submit lyrics for any song?**
You can submit, but publication requires administrator approval and compliance with the platform's rights policy. Some songs may only display annotations or metadata until rights are confirmed.

**How do artists get verified?**
Initially through manual review by administrators. More automated verification will follow.

**How does DrillKe make money?**
The only planned commercial model so far is the proposed 10% commission on eligible merchandise sold through the platform. Details will be published before the feature launches.

**Will it support other genres or countries?**
The focus is Kenyan drill. The architecture is designed so other drill scenes can be added once the foundation is solid.

**Why open source?**
Transparency and community ownership. People who care about the culture should be able to see how the platform works and help improve it.

---

## Acknowledgements

- The Kenyan drill artists, producers, videographers, and fans who make the scene what it is.
- Projects that inspired the experience: Musixmatch (synchronized lyrics) and PotPlayer (seamless local playback).
- The open-source communities behind Next.js, React, Tailwind CSS, PostgreSQL, and the tools this project is built on.

---

## License

**Code:** released under the [MIT License](LICENSE) *(proposed; confirm before the first public release. If you want improvements to hosted versions to stay open, consider AGPL-3.0 instead)*.

**Content:** lyrics, artwork, trademarks, and music are **not** covered by the code license. They remain the property of their respective owners and are used only with appropriate rights or permission. Community contributions are subject to the contribution terms in `CONTRIBUTING.md`.

---

<p align="center">
  <b>DrillKe</b> · Built by the community, for the culture. 🇰🇪<br/>
  <i>One track at a time.</i>
</p>
