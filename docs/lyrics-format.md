# DrillKe — Lyrics format

The authoring format, the parsed representation, and the rules the parser
enforces. This is a **contract**: `apps/api` (validation), `apps/web` (editing)
and `packages/shared` (parsing) all implement it.

> Markdown is the **authoring** format, not the playback engine. The player
> consumes structured `LyricLine[]` only.

---

## 1. File shape

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
validation time.

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

A bracketed token that is not a timestamp is a section label and is excluded
from the line list (it becomes metadata). Do not use brackets for anything else.

### Annotations

```markdown
## Annotations

- **"phrase"** — explanation
- **"phrase"** *(line 3)* — explanation anchored to a line (1-based)
```

- `phrase` must appear in the lyric text (case-insensitive). Validation fails
  otherwise, so annotations cannot drift from the lyrics.
- `lineIndex` is optional. When absent, the first matching line is used.
- Explanations are plain text/Markdown-inline only — no raw HTML, no links to
  untrusted hosts.

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

## 4. Validation rules (server-side, always)

| Rule | Failure |
|---|---|
| Frontmatter parses and has required fields | `422` with `fieldErrors` |
| `youtubeVideoId` matches `^[A-Za-z0-9_-]{11}$` | `422` |
| Timestamps match the pattern and are non-decreasing | `422` |
| At least one line of text | `422` |
| Annotation phrase exists in the text | `422` |
| Body ≤ 512 KB, ≤ 500 lines | `413` |
| Submitter is authenticated and not throttled | `401` / `429` |

The **client mirrors** these rules for a good editing experience, but the server
re-validates every submission with the same shared parser. Never trust the client.

## 5. Worked example — common mistakes

| Input | Result |
|---|---|
| `[0:12] line` | ❌ minutes must be 2 digits, seconds 2 digits, millis 3 |
| `[00:12.500]` then `[00:10.000]` | ❌ timestamps go backwards |
| Lines with no timestamps at all | ✅ `unsynchronized` |
| Annotation phrase not in lyrics | ❌ prevented by validation |
| `<script>…</script>` in a line | ✅ stored as **text**, rendered escaped |
| Duplicate `youtubeVideoId` for two songs | ⚠️ allowed at parse, deduped in review |

## 6. Import / export

- Export writes one `.md` file per published song to `content/` using this exact
  format, so an export can be re-imported byte-for-byte.
- Import is idempotent by `(artist, title, youtubeVideoId)`: an unchanged file
  produces no new version; a changed file produces a **pending** submission.
- Export is generated, never hand-edited; edits go through the review flow.

## 7. Timing guidance for contributors

- Sync on the **first syllable**, not on the beat before it.
- A line that spans a pause keeps its `startMs`; the parser derives `endMs` from
  the next line.
- Leave `endMs` out unless a gap must be explicit — the player handles gaps.
- Target accuracy: within ±150 ms of the vocal onset.
