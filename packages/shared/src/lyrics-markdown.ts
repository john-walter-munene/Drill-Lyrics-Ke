/**
 * Markdown authoring format: parse and serialize.
 *
 * `docs/lyrics-format.md` §1–§2 is the specification; this module is the
 * implementation of it. Two consumers:
 *
 *   - the `/submit` form, so a contributor can paste or upload a `.md` file
 *     instead of typing lines into a textarea;
 *   - the `content/` import/export scripts, so the whole catalogue can round-trip
 *     through files in Git without a database export.
 *
 * The format is deliberately small: YAML-ish frontmatter between `---` fences, a
 * lyric body, and an optional `## Annotations` section. It is **not** general
 * Markdown — there is no inline formatting, no nested structure and no raw HTML.
 * That keeps parsing unambiguous and means a malformed file fails with a line
 * number instead of rendering something surprising.
 *
 * Keep it environment-free: string in, typed result out. No DOM, no Node, no
 * filesystem.
 */

import {
  MAX_ANNOTATION_EXPLANATION,
  MAX_ANNOTATION_PHRASE,
  MAX_ANNOTATIONS,
  parseLyricsText,
  resolveAnnotations,
  YOUTUBE_ID_PATTERN,
  type Annotation,
  type LyricsFieldErrors,
  type ParsedLyrics,
} from './lyrics.ts';

/** Languages the format accepts (mirrors the Prisma `Language` enum). */
export const LYRIC_LANGUAGES = ['sheng', 'swahili', 'english', 'mixed'] as const;
export type LyricLanguage = (typeof LYRIC_LANGUAGES)[number];

/** Statuses the frontmatter may carry; ignored on submission. */
export const LYRIC_STATUSES = ['draft', 'pending', 'published'] as const;

/** Every frontmatter key the format defines. Unknown keys are rejected. */
export const FRONTMATTER_KEYS = [
  'title',
  'artist',
  'featuring',
  'youtubeVideoId',
  'language',
  'releaseDate',
  'status',
] as const;

export interface LyricsFrontmatter {
  title: string;
  artist: string;
  featuring: string[];
  youtubeVideoId: string;
  language: LyricLanguage;
  releaseDate?: string;
  status?: (typeof LYRIC_STATUSES)[number];
}

export interface LyricsDocument {
  frontmatter: LyricsFrontmatter;
  lyrics: ParsedLyrics;
}

export type LyricsDocumentResult =
  | { ok: true; document: LyricsDocument }
  | { ok: false; errors: LyricsFieldErrors };

/**
 * Parse a full Markdown lyrics document.
 *
 * Errors are keyed by field (`frontmatter`, `title`, `youtubeVideoId`,
 * `lyrics`, `annotations`, …) so a form can put each message beside the input
 * that caused it, and every message names a line where that helps.
 */
export function parseLyricsDocument(source: string): LyricsDocumentResult {
  const errors: LyricsFieldErrors = {};
  const add = (field: string, message: string) => {
    errors[field] = [...(errors[field] ?? []), message];
  };

  if (typeof source !== 'string' || !source.trim()) {
    return { ok: false, errors: { document: ['The file is empty.'] } };
  }

  const normalized = source.replace(/\r\n?/g, '\n');
  const frontmatter = splitFrontmatter(normalized);
  if (!frontmatter.ok) return { ok: false, errors: frontmatter.errors };

  const parsedFrontmatter = parseFrontmatter(frontmatter.raw, frontmatter.startLine, add);
  const body = parseBody(frontmatter.body);

  if (!body.lines.length) add('lyrics', 'Add at least one lyric line below the frontmatter.');
  const lyricParse = parseLyricsText(body.lyricText);
  if (!lyricParse.ok) {
    for (const messages of Object.values(lyricParse.errors)) {
      for (const message of messages) add('lyrics', message);
    }
  }

  if (!parsedFrontmatter || !lyricParse.ok) {
    return { ok: false, errors };
  }

  const annotations = parseAnnotationSection(body.annotationLines);
  const resolved = resolveAnnotations(lyricParse.lyrics.lines, annotations);
  if (!resolved.ok) {
    for (const message of Object.values(resolved.errors).flat()) add('annotations', message);
    return { ok: false, errors };
  }

  return {
    ok: true,
    document: {
      frontmatter: parsedFrontmatter,
      lyrics: {
        syncStatus: lyricParse.lyrics.syncStatus,
        lines: lyricParse.lyrics.lines,
        annotations: resolved.annotations,
      },
    },
  };
}

/** Split `---` frontmatter from the body. Requires the fence on line 1. */
function splitFrontmatter(source: string):
  | { ok: true; raw: string; body: string; startLine: number }
  | { ok: false; errors: LyricsFieldErrors } {
  const lines = source.split('\n');
  if (lines[0].trim() !== '---') {
    return {
      ok: false,
      errors: { frontmatter: ['The file must start with a `---` frontmatter block (see docs/lyrics-format.md).'] },
    };
  }
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closing < 0) {
    return { ok: false, errors: { frontmatter: ['The frontmatter block is never closed with a second `---`.'] } };
  }
  return {
    ok: true,
    raw: lines.slice(1, closing).join('\n'),
    body: lines.slice(closing + 1).join('\n'),
    // 1-based line number of the first frontmatter key, for error messages.
    startLine: 2,
  };
}

/**
 * Parse the small YAML subset the format uses: `key: value`, where a value is a
 * quoted or bare scalar, or a bracketed / dash list of scalars. Anything else is
 * a syntax error rather than a best guess — a silently misread title is worse
 * than a refused file.
 */
function parseFrontmatter(
  raw: string,
  startLine: number,
  add: (field: string, message: string) => void,
): LyricsFrontmatter | null {
  const values = new Map<string, { value: string; line: number }>();
  const lines = raw.split('\n');
  // Syntax problems are tracked locally so a single bad line does not stop the
  // rest of the block being read and reported in one pass.
  let syntaxErrors = 0;
  // Field-level problems (unknown key, duplicate, bad value) also make the block
  // unusable, but they are reported against their own field, so they are counted
  // separately from the line-syntax errors above.
  let fieldErrors = 0;
  const flag = (field: string, message: string) => {
    add(field, message);
    fieldErrors += 1;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNumber = startLine + i;
    if (!line.trim() || line.trim().startsWith('#')) continue;
    // Nested structures are not part of the format.
    if (/^\s+/.test(line)) {
      add('frontmatter', `Line ${lineNumber}: nested frontmatter is not supported; use a single-line list.`);
      syntaxErrors += 1;
      continue;
    }
    const match = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line);
    if (!match) {
      add('frontmatter', `Line ${lineNumber}: expected \`key: value\`.`);
      syntaxErrors += 1;
      continue;
    }
    const [, key, rest] = match;
    if (!(FRONTMATTER_KEYS as readonly string[]).includes(key)) {
      flag(key, `Line ${lineNumber}: unknown frontmatter key \`${key}\`.`);
      continue;
    }
    if (values.has(key)) {
      flag(key, `Line ${lineNumber}: \`${key}\` is set more than once.`);
      continue;
    }
    values.set(key, { value: rest.trim(), line: lineNumber });
  }

  const text = (key: string): string | null => {
    const entry = values.get(key);
    if (!entry) return null;
    const unquoted = stripQuotes(entry.value);
    if (unquoted == null) {
      flag(key, `Line ${entry.line}: value has an unterminated quote.`);
      return null;
    }
    return unquoted;
  };

  const title = text('title');
  const artist = text('artist');
  const videoId = text('youtubeVideoId');
  const language = text('language');
  const releaseDate = text('releaseDate');
  const status = text('status');

  if (!title) flag('title', '`title` is required.');
  if (!artist) flag('artist', '`artist` is required.');
  if (!videoId) flag('youtubeVideoId', '`youtubeVideoId` is required.');
  else if (!YOUTUBE_ID_PATTERN.test(videoId)) {
    flag('youtubeVideoId', `\`${videoId}\` is not an 11-character YouTube video id.`);
  }

  let resolvedLanguage: LyricLanguage = 'mixed';
  if (language != null) {
    if (!(LYRIC_LANGUAGES as readonly string[]).includes(language)) {
      flag('language', `\`${language}\` is not one of ${LYRIC_LANGUAGES.join(', ')}.`);
    } else {
      resolvedLanguage = language as LyricLanguage;
    }
  }

  let resolvedStatus: (typeof LYRIC_STATUSES)[number] | undefined;
  if (status != null) {
    if (!(LYRIC_STATUSES as readonly string[]).includes(status)) {
      flag('status', `\`${status}\` is not one of ${LYRIC_STATUSES.join(', ')}.`);
    } else {
      resolvedStatus = status as (typeof LYRIC_STATUSES)[number];
    }
  }

  if (releaseDate != null && !isIsoDate(releaseDate)) {
    flag('releaseDate', `\`${releaseDate}\` is not a \`YYYY-MM-DD\` date.`);
  }

  const featuringEntry = values.get('featuring');
  let featuring: string[] = [];
  if (featuringEntry) {
    const list = parseList(featuringEntry.value);
    if (list == null) {
      flag('featuring', `Line ${featuringEntry.line}: expected a list, e.g. \`["Artist A", "Artist B"]\`.`);
    } else {
      featuring = list;
    }
  }

  if (syntaxErrors > 0 || fieldErrors > 0 || !title || !artist || !videoId) return null;

  return {
    title,
    artist,
    featuring,
    youtubeVideoId: videoId,
    language: resolvedLanguage,
    ...(releaseDate != null ? { releaseDate } : {}),
    ...(resolvedStatus ? { status: resolvedStatus } : {}),
  };
}

/** Split the body into lyric text and the optional `## Annotations` section. */
function parseBody(body: string): { lines: string[]; lyricText: string; annotationLines: string[] } {
  const lines = body.split('\n');
  const headingIndex = lines.findIndex((line) => /^##\s+Annotations\s*$/i.test(line.trim()));
  const lyricLines = headingIndex < 0 ? lines : lines.slice(0, headingIndex);
  const annotationLines = headingIndex < 0 ? [] : lines.slice(headingIndex + 1);

  // `# Lyrics` is a presentational heading in the example, not content.
  const lyricText = lyricLines
    .filter((line) => !/^#\s+Lyrics\s*$/i.test(line.trim()))
    .join('\n');

  return { lines: lyricText.split('\n').filter((line) => line.trim()), lyricText, annotationLines };
}

/**
 * `- **"phrase"** — explanation` or `- **"phrase"** *(line 3)* — explanation`.
 *
 * The em dash is the separator the docs specify; an ASCII `--` is accepted too
 * because it is what a keyboard without an em-dash produces.
 */
export function parseAnnotationSection(lines: readonly string[]): Annotation[] {
  const annotations: Annotation[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('<!--')) continue;
    if (!line.startsWith('-')) continue;

    const match = /^-\s+\*\*"(.+?)"\*\*(?:\s*\*\(line (\d+)\)\*)?\s*(?:—|--)\s*(.+)$/.exec(line);
    if (!match) continue;
    const [, phrase, lineNumber, explanation] = match;
    annotations.push({
      phrase: phrase.trim(),
      explanation: explanation.trim(),
      // The format is 1-based; the stored annotation is 0-based.
      ...(lineNumber ? { lineIndex: Number(lineNumber) - 1 } : {}),
    });
  }
  return annotations;
}

/**
 * Serialize a document back to the authoring format.
 *
 * Round-trip is the contract (`docs/lyrics-format.md` §6): parsing the output of
 * this function must produce the same document, so an export can be re-imported
 * byte-for-byte. Fields are emitted in a fixed order and annotations are sorted
 * by line so two exports of the same version are identical.
 */
export function serializeLyricsDocument(document: LyricsDocument): string {
  const { frontmatter, lyrics } = document;
  const out: string[] = ['---'];
  out.push(`title: ${quote(frontmatter.title)}`);
  out.push(`artist: ${quote(frontmatter.artist)}`);
  if (frontmatter.featuring.length) {
    out.push(`featuring: [${frontmatter.featuring.map(quote).join(', ')}]`);
  } else {
    out.push('featuring: []');
  }
  out.push(`youtubeVideoId: ${quote(frontmatter.youtubeVideoId)}`);
  out.push(`language: ${frontmatter.language}`);
  if (frontmatter.releaseDate) out.push(`releaseDate: ${frontmatter.releaseDate}`);
  if (frontmatter.status) out.push(`status: ${frontmatter.status}`);
  out.push('---', '', '# Lyrics', '');

  for (const line of lyrics.lines) {
    out.push(line.startMs >= 0 ? `[${msToTimestampLocal(line.startMs)}] ${line.text}` : line.text);
  }

  if (lyrics.annotations.length) {
    out.push('', '## Annotations', '');
    const sorted = [...lyrics.annotations].sort((a, b) => (a.lineIndex ?? 0) - (b.lineIndex ?? 0));
    for (const annotation of sorted) {
      const anchor = annotation.lineIndex == null ? '' : ` *(line ${annotation.lineIndex + 1})*`;
      out.push(`- **"${annotation.phrase}"**${anchor} — ${annotation.explanation}`);
    }
  }

  return `${out.join('\n')}\n`;
}

/** `mm:ss.mmm` / `hh:mm:ss.mmm` — duplicated locally to keep this module leaf-level. */
function msToTimestampLocal(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const millis = safe % 1_000;
  const base = `${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
  return hours > 0 ? `${pad(hours)}:${base}` : base;
}

/** Strip matching single or double quotes. `null` means the quote is unterminated. */
function stripQuotes(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const first = trimmed[0];
  if (first !== '"' && first !== "'") return trimmed;
  if (trimmed.length < 2 || trimmed[trimmed.length - 1] !== first) return null;
  return unescapeQuoted(trimmed.slice(1, -1));
}

/** Reverse of the escaping `quote()` applies to a double-quoted value. */
function unescapeQuoted(value: string): string {
  return value.replace(/\\([\\"])/g, '$1');
}

/** `["a", "b"]` or `[a, b]` → list. `[]` → empty. `null` on malformed input. */
function parseList(value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  const items: string[] = [];
  for (const part of inner.split(',')) {
    const unquoted = stripQuotes(part);
    if (unquoted == null || !unquoted) return null;
    items.push(unquoted);
  }
  return items;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Re-exported so callers of this module do not need two imports. */
export { MAX_ANNOTATION_EXPLANATION, MAX_ANNOTATION_PHRASE, MAX_ANNOTATIONS };
