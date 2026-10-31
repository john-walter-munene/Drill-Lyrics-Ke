import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseAnnotationSection,
  parseLyricsDocument,
  serializeLyricsDocument,
  type LyricsDocument,
} from './lyrics-markdown.ts';

const VALID = `---
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
`;

function parseOk(source: string): LyricsDocument {
  const result = parseLyricsDocument(source);
  assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.errors));
  if (!result.ok) throw new Error('unreachable');
  return result.document;
}

test('parseLyricsDocument reads frontmatter, lines and annotations', () => {
  const document = parseOk(VALID);
  assert.equal(document.frontmatter.title, 'Example Track');
  assert.equal(document.frontmatter.artist, 'Example Artist');
  assert.equal(document.frontmatter.youtubeVideoId, 'dQw4w9WgXcQ');
  assert.equal(document.frontmatter.language, 'sheng');
  assert.equal(document.frontmatter.releaseDate, '2026-03-14');
  assert.equal(document.frontmatter.status, 'draft');
  assert.deepEqual(document.frontmatter.featuring, []);

  assert.equal(document.lyrics.syncStatus, 'synchronized');
  assert.equal(document.lyrics.lines.length, 3);
  assert.equal(document.lyrics.lines[0].startMs, 12_500);
  assert.equal(document.lyrics.lines[0].text, 'First line of the verse.');

  // The first annotation resolves to the line that actually contains it.
  assert.equal(document.lyrics.annotations.length, 2);
  assert.equal(document.lyrics.annotations[0].lineIndex, 0);
  // The explicit `(line 2)` is 1-based in the format, 0-based once parsed.
  assert.equal(document.lyrics.annotations[1].lineIndex, 1);
});

test('parseLyricsDocument treats untimed lyrics as unsynchronized', () => {
  const document = parseOk(`---
title: "T"
artist: "A"
youtubeVideoId: "dQw4w9WgXcQ"
---

just some words
and more words
`);
  assert.equal(document.lyrics.syncStatus, 'unsynchronized');
  assert.equal(document.lyrics.lines.length, 2);
  assert.equal(document.lyrics.lines[0].startMs, -1);
  // Language defaults to mixed when the key is absent.
  assert.equal(document.frontmatter.language, 'mixed');
});

test('parseLyricsDocument rejects a missing or unclosed frontmatter fence', () => {
  const missing = parseLyricsDocument('# Lyrics\n\nline');
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.errors.frontmatter[0], /must start with a `---`/);

  const unclosed = parseLyricsDocument('---\ntitle: "T"\n\nline');
  assert.equal(unclosed.ok, false);
  if (!unclosed.ok) assert.match(unclosed.errors.frontmatter[0], /never closed/);
});

test('parseLyricsDocument rejects unknown frontmatter keys', () => {
  const result = parseLyricsDocument(`---
title: "T"
artist: "A"
youtubeVideoId: "dQw4w9WgXcQ"
titel: "typo"
---

line
`);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.titel[0], /unknown frontmatter key/);
});

test('parseLyricsDocument validates required fields and the video id', () => {
  const result = parseLyricsDocument(`---
title: "T"
youtubeVideoId: "too-short"
language: klingon
releaseDate: 2026-02-31
status: live
---

line
`);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.artist[0], /required/);
    assert.match(result.errors.youtubeVideoId[0], /11-character/);
    assert.match(result.errors.language[0], /not one of/);
    assert.match(result.errors.releaseDate[0], /YYYY-MM-DD/);
    assert.match(result.errors.status[0], /not one of/);
  }
});

test('parseLyricsDocument parses quoted and bare list values', () => {
  const quoted = parseOk(`---
title: "T"
artist: "A"
featuring: ["Artist B", "Artist C"]
youtubeVideoId: "dQw4w9WgXcQ"
---

line
`);
  assert.deepEqual(quoted.frontmatter.featuring, ['Artist B', 'Artist C']);

  const bare = parseOk(`---
title: "T"
artist: "A"
featuring: [B, C]
youtubeVideoId: "dQw4w9WgXcQ"
---

line
`);
  assert.deepEqual(bare.frontmatter.featuring, ['B', 'C']);
});

test('parseLyricsDocument rejects a malformed featuring list', () => {
  const result = parseLyricsDocument(`---
title: "T"
artist: "A"
featuring: Artist B
youtubeVideoId: "dQw4w9WgXcQ"
---

line
`);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.featuring[0], /expected a list/);
});

test('parseLyricsDocument rejects an annotation phrase that is not on its line', () => {
  const result = parseLyricsDocument(`---
title: "T"
artist: "A"
youtubeVideoId: "dQw4w9WgXcQ"
---

[00:01.000] alpha beta
[00:02.000] gamma delta

## Annotations

- **"gamma"** *(line 1)* — Anchored to the wrong line.
`);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.annotations[0], /does not appear on line 1/);
});

test('parseLyricsDocument rejects decreasing timestamps with a line number', () => {
  const result = parseLyricsDocument(`---
title: "T"
artist: "A"
youtubeVideoId: "dQw4w9WgXcQ"
---

[00:05.000] later
[00:01.000] earlier
`);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.lyrics.join(' '), /moves backwards/);
});

test('parseLyricsDocument rejects an empty body', () => {
  const result = parseLyricsDocument(`---
title: "T"
artist: "A"
youtubeVideoId: "dQw4w9WgXcQ"
---

`);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.lyrics[0], /at least one lyric line/);
});

test('parseAnnotationSection ignores non-list and malformed rows', () => {
  const annotations = parseAnnotationSection([
    'Some prose that is not an annotation.',
    '- **"kept"** — yes',
    '- not a bold phrase — no',
    '<!-- a comment -->',
    '',
  ]);
  assert.equal(annotations.length, 1);
  assert.equal(annotations[0].phrase, 'kept');
  assert.equal(annotations[0].explanation, 'yes');
});

test('serializeLyricsDocument round-trips through the parser', () => {
  const original = parseOk(VALID);
  const serialized = serializeLyricsDocument(original);
  const reparsed = parseOk(serialized);

  assert.deepEqual(reparsed.frontmatter, original.frontmatter);
  assert.deepEqual(reparsed.lyrics.lines, original.lyrics.lines);
  assert.deepEqual(reparsed.lyrics.annotations, original.lyrics.annotations);
  assert.equal(reparsed.lyrics.syncStatus, original.lyrics.syncStatus);

  // Serialization is stable: a second pass produces identical bytes.
  assert.equal(serializeLyricsDocument(reparsed), serialized);
});

test('serializeLyricsDocument escapes quotes in frontmatter values', () => {
  const serialized = serializeLyricsDocument({
    frontmatter: {
      title: 'A "quoted" title',
      artist: 'Artist',
      featuring: ['Guest "One"'],
      youtubeVideoId: 'dQw4w9WgXcQ',
      language: 'mixed',
    },
    lyrics: { syncStatus: 'unsynchronized', lines: [{ index: 0, startMs: -1, text: 'line' }], annotations: [] },
  });
  const reparsed = parseOk(serialized);
  assert.equal(reparsed.frontmatter.title, 'A "quoted" title');
  assert.deepEqual(reparsed.frontmatter.featuring, ['Guest "One"']);
});

test('serializeLyricsDocument emits hour-scale timestamps unchanged', () => {
  const document: LyricsDocument = {
    frontmatter: {
      title: 'Long',
      artist: 'Artist',
      featuring: [],
      youtubeVideoId: 'dQw4w9WgXcQ',
      language: 'mixed',
    },
    lyrics: {
      syncStatus: 'synchronized',
      lines: [{ index: 0, startMs: 3_723_456, text: 'over an hour in' }],
      annotations: [],
    },
  };
  const reparsed = parseOk(serializeLyricsDocument(document));
  assert.equal(reparsed.lyrics.lines[0].startMs, 3_723_456);
});
