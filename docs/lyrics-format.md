# DrillKe — Lyrics format

Two submission paths share one parser:

- **One line per row** — plain text tied to a selected catalogue song, with
  optional `[mm:ss.mmm]` timestamps.
- **Markdown with frontmatter** — a `.md` file (uploaded or pasted) carrying
  title, artist, video id, language and an optional annotations section.

Both are validated server-side with the same code
(`parseLyricsDocument` for Markdown, `parseLyricsText` for text). The Markdown
form is also the import/export format for `content/` (`npm run content:export`,
`npm run content:import`). Annotations are authored by reviewers in the admin
lyrics editor, or supplied by a Markdown file, and published with the reviewed
lyric version.

> Markdown is the **authoring** format, not the playback engine. The player
> consumes structured `LyricLine[]` only.

---

## 1. File shape

### Browser text submissions

The `/submit` form accepts up to 500 non-empty rows. A row may be plain lyric
text or begin with `[mm:ss.mmm]` / `[hh:mm:ss.mmm]`; timestamps must not go
backwards. All lines need valid timestamps for the submission to be marked
synchronized. Plain or mixed timed/untimed text is stored as unsynchronized.
The form's selected `songId` is authoritative for song and video association.
The original text is preserved with the pending submission.

The Markdown example below is the content import/export format. The `/submit`
form accepts it as an uploaded file or a pasted document, and the content
scripts read and write it.

```markdown
---
title: "Example Track"
artist: "Example Artist"
featuring: []
youtubeVideoId: "dQw4w9WgXcQ"
language: "sheng"
releaseDate: 2026-03-14
status: draft
---

# Lyrics

[00:12.500] First line of the verse.
[00:15.200] Second line of the verse.
[00:18.100] Third line of the verse.

## Annotations

- **"first line"** — What the phrase means, and why it lands.
- **"verse"** *(line 2)* — A reference explained.
```

> The example is placeholder text, not a real song. Never commit real lyrics
> unless the rights holder has granted permission.

### Frontmatter

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | Display title |
| `artist` | string | yes | Primary artist name (resolved to an `Artist`) |
| `featuring` | string[] | no | Additional artist names |
| `youtubeVideoId` | string | yes | 11-character YouTube id |
| `language` | `sheng` \| `swahili` \| `english` \| `mixed` | no | Defaults to `mixed` |
| `releaseDate` | `YYYY-MM-DD` | no | Drives sort order on artist pages |
| `status` | `draft` \| `pending` \| `published` | no | Ignored on submission (server sets it) |

Unknown frontmatter keys are **rejected**, not ignored, so typos surface at
validation time. Values may be quoted or bare; a quoted value may contain
escaped `\"`. A list must be a single-line `[…]` form — nested frontmatter is
not part of the format and is rejected with a line number.

## 2. Syntax

### Lyric lines

```text
[mm:ss.mmm] text
[hh:mm:ss.mmm] text        (after the first hour)
```

- Timestamp must be non-decreasing. Equal timestamps are allowed (two lines at
  once); decreasing timestamps are an error.
- A line with **no** timestamp makes the whole version `unsynchronized`. Untimed
  lines are preserved in order and are readable, but the player will not
  highlight them.
- Empty lines are removed. Comments use `<!-- … -->` and are stripped.
- Leading/trailing whitespace inside the text is trimmed; internal spacing is
  preserved.

### Section labels

Optional, purely for authoring and review readability:

```text
[Verse 1]
[00:12.500] First line…
```

The current plain-text parser treats non-timestamp rows as lyric text. Bracketed
section labels are not interpreted specially by the current implementation.

### Annotations

```markdown
## Annotations

- **"phrase"** — explanation
- **"phrase"** *(line 3)* — explanation anchored to a line (1-based)
```

- Both import paths require `phrase` to appear in lyric text (case-insensitive),
  so annotations cannot drift from the lyrics. `resolveAnnotations()` in
  `packages/shared` enforces this for the admin editor and for Markdown files.
- `lineIndex` is optional in the format. When absent, the first matching line is
  used; the stored annotation always carries the resolved 0-based `lineIndex`.
- A line may carry more than one annotation, and a phrase may be explained more
  than once; nothing in this format forbids either.
- Explanations are plain text only — no raw HTML, no links to untrusted hosts.
- Limits: 100 annotations per version, 80 characters per phrase, 2,000 per
  explanation.

## 3. Parsed representation

Exported from `@drillke/shared` (`lyrics.ts`):

```ts
type LyricLine = {
  index: number;     // 0-based position
  startMs: number;   // milliseconds from start
  endMs?: number;    // derived from the next line when omitted
  text: string;
};

type Annotation = {
  phrase: string;
  explanation: string;
  lineIndex?: number;
};

type ParsedLyrics =
  | { syncStatus: 'unsynchronized'; lines: LyricLine[]; annotations: Annotation[] }
  | { syncStatus: 'synchronized'; lines: LyricLine[]; annotations: Annotation[] };
```

API payload (`GET /api/songs/:slug/lyrics`) — one object per song:

```json
{
  "versionId": "clx…",
  "syncStatus": "synchronized",
  "lines": [{ "index": 0, "startMs": 12500, "endMs": 15200, "text": "…" }],
  "annotations": [{ "phrase": "…", "explanation": "…", "lineIndex": 0 }]
}
```

## 4. Submission validation

| Rule | Failure |
|---|---|
| Body exceeds 512 KB | `400` from DTO validation |
| Timestamps malformed or decreasing | `422` |
| Empty lyrics or more than 500 non-empty lines | `422` |
| No published song matches the selected `songId` | `404` |
| Guest submission exceeds write throttle | `429` |
| Annotation phrase empty, missing from the lyrics, or pointing at a non-existent line | `409` (admin save/approve) |
| Markdown: invalid frontmatter, video ID or annotation phrase | `422`, reported per field with line numbers where useful |

The text form accepts guest submissions; sign-in is not required. A successful
response returns a submission reference and `pending` status. The text is stored
against the selected catalogue song and does not become playable lyrics until a
moderator publishes a version.

The `/submit` form previews validation in the browser; the server re-validates
every submission with the same shared parser (`parseLyricsDocument` for a
Markdown body, `parseLyricsText` otherwise), so the preview cannot accept
something the server will refuse.

Moderators can add timing to a pending submission from the admin review queue.
They play the selected YouTube video, mark each lyric at its vocal onset, and
can fine-tune each timestamp in seconds before saving. The editor uses the shared
player clock, serializes `[mm:ss.mmm]` values into the pending text, and rejects
decreasing times. The lyrics remain pending until a separate approval action;
only a version where every line has a timestamp is published as synchronized.

Optionally, a moderator can pick an audio file of the song and let the shared
line-sync estimator pre-fill every timestamp. The estimator is a starting point
only: it never saves on its own, and the editor shows its confidence so the
reviewer knows whether to trust it or time the lines by hand.

Where the analysis runs is decided per device (`chooseSyncRoute` in
`apps/web/app/admin/sync-estimate.ts`):

- **In the browser** by default — the clip stays on the device and any format
the browser can decode (MP3, M4A, Opus) works.
- **On the server** when the device reports four cores or fewer, 4 GB of memory
  or less, data-saver mode, or a clip longer than four minutes — or when the
  moderator ticks **Estimate on the server**. The browser decodes the clip
  once, writes a mono 16 kHz 16-bit WAV (`apps/web/app/admin/wav.ts`) and posts
  it to `POST /api/admin/lyrics/:id/sync-estimate`.

Both routes call the same `alignLyrics` from `@drillke/shared`, so the
suggestion does not depend on which side ran it. Only WAV is accepted by the
API (pure-TypeScript decode, no native codec); clips over 15 minutes are
refused and the editor says to time the lines by hand instead.
`npm run smoke:sync-estimate` exercises the server route against a live stack and
checks that the returned timings recover the onsets in a synthetic clip.

## 5. Worked example — common mistakes

| Input | Result |
|---|---|
| `[0:12] line` | ❌ minutes must be 2 digits, seconds 2 digits, millis 3 |
| `[00:12.500]` then `[00:10.000]` | ❌ timestamps go backwards |
| Lines with no timestamps at all | ✅ `unsynchronized` |
| Annotation phrase not in lyrics | ❌ rejected by `resolveAnnotations` (admin editor and Markdown import) |
| `<script>…</script>` in a line | ✅ stored as **text**, rendered escaped |
| Duplicate `youtubeVideoId` for two songs | ⚠️ allowed at parse, deduped in review |

## 6. Import / export (`scripts/content.mjs`)

```powershell
npm run content:export              # published songs → content/<artist>/<song>.md
npm run content:import              # content/**.md → pending submissions
npm run content:import -- --dry-run # report only, write nothing
```

- Export writes one `.md` file per published song to `content/` using this exact
  format, so an export can be re-imported byte-for-byte. Serialization is stable:
  two exports of the same version are identical, and annotations are ordered by
  line so a diff only shows real changes.
- Import is idempotent by published state: a file that matches the published
  version (lines **and** annotations) produces nothing; a changed file produces a
  **pending** submission. A song is only matched by `youtubeVideoId`; a file for a
  video that is not in the catalogue is skipped with a warning.
- Import never publishes. A moderator still reviews and approves, exactly as for
  a submission from the site.
- Export should be generated, never hand-edited; edits go through the review flow.
- The scripts use Prisma directly, so they work in CI and locally without a
  running API. They are not wired into CI.

## 7. Timing guidance for contributors

- Sync on the **first syllable**, not on the beat before it.
- A line that spans a pause keeps its `startMs`; the parser derives `endMs` from
  the next line.
- Leave `endMs` out unless a gap must be explicit — the player handles gaps.
- Target accuracy: within ±150 ms of the vocal onset.
