import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findActiveLineIndex,
  isSynchronized,
  msToTimestamp,
  resolveAnnotations,
  timestampToMs,
  withDerivedEnds,
  type LyricLine,
} from './lyrics.ts';

const lines: LyricLine[] = [
  { index: 0, startMs: 12_500, text: 'first' },
  { index: 1, startMs: 15_200, text: 'second' },
  { index: 2, startMs: 18_100, text: 'third' },
];

test('timestampToMs parses mm:ss.mmm', () => {
  assert.equal(timestampToMs('[00:12.500]'), 12_500);
  assert.equal(timestampToMs('[01:02.003]'), 62_003);
});

test('timestampToMs parses hh:mm:ss.mmm past the first hour', () => {
  assert.equal(timestampToMs('[01:00:00.000]'), 3_600_000);
});

test('timestampToMs rejects malformed or out-of-range input', () => {
  assert.equal(timestampToMs('[0:12]'), null);
  assert.equal(timestampToMs('[00:75.000]'), null);
  assert.equal(timestampToMs('no timestamp'), null);
});

test('msToTimestamp round-trips and pads correctly', () => {
  assert.equal(msToTimestamp(12_500), '00:12.500');
  assert.equal(msToTimestamp(3_601_234), '01:00:01.234');
  assert.equal(msToTimestamp(-50), '00:00.000');
});

test('findActiveLineIndex returns -1 before the first line', () => {
  assert.equal(findActiveLineIndex(lines, 0), -1);
  assert.equal(findActiveLineIndex(lines, 12_499), -1);
});

test('findActiveLineIndex finds the active line across boundaries', () => {
  assert.equal(findActiveLineIndex(lines, 12_500), 0);
  assert.equal(findActiveLineIndex(lines, 15_199), 0);
  assert.equal(findActiveLineIndex(lines, 20_000), 2);
});

test('findActiveLineIndex handles an empty list', () => {
  assert.equal(findActiveLineIndex([], 1_000), -1);
});

test('isSynchronized requires at least one timed line', () => {
  assert.equal(isSynchronized(lines), true);
  assert.equal(isSynchronized([]), false);
  assert.equal(isSynchronized([{ index: 0, startMs: -1, text: 'x' }]), false);
});

test('withDerivedEnds fills gaps without mutating the input', () => {
  const derived = withDerivedEnds(lines);
  assert.equal(derived[0].endMs, 15_200);
  assert.equal(derived[2].endMs, undefined);
  assert.equal(lines[0].endMs, undefined);
});

const annotationLines: LyricLine[] = [
  { index: 0, startMs: -1, text: 'Nairobi nights, tunachapa kazi' },
  { index: 1, startMs: -1, text: 'Wanatoka Eastlands hadi CBD' },
];

test('resolveAnnotations anchors an omitted line to the first matching line', () => {
  const result = resolveAnnotations(annotationLines, [{ phrase: 'eastlands', explanation: 'An area of Nairobi.' }]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.annotations, [{ phrase: 'eastlands', explanation: 'An area of Nairobi.', lineIndex: 1 }]);
});

test('resolveAnnotations honours an explicit line and trims values', () => {
  const result = resolveAnnotations(annotationLines, [{ phrase: '  CBD ', explanation: ' Central business district. ', lineIndex: 1 }]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.annotations, [{ phrase: 'CBD', explanation: 'Central business district.', lineIndex: 1 }]);
});

test('resolveAnnotations rejects phrases that drift from the lyrics', () => {
  const missing = resolveAnnotations(annotationLines, [{ phrase: 'Mombasa', explanation: 'x' }]);
  assert.equal(missing.ok, false);
  if (missing.ok) return;
  assert.match(missing.errors.annotations[0], /does not appear/);

  const wrongLine = resolveAnnotations(annotationLines, [{ phrase: 'CBD', explanation: 'x', lineIndex: 0 }]);
  assert.equal(wrongLine.ok, false);

  const missingLine = resolveAnnotations(annotationLines, [{ phrase: 'CBD', explanation: 'x', lineIndex: 9 }]);
  assert.equal(missingLine.ok, false);
});

test('resolveAnnotations rejects empty or oversized fields', () => {
  const empty = resolveAnnotations(annotationLines, [{ phrase: 'CBD', explanation: '   ' }]);
  assert.equal(empty.ok, false);
  if (empty.ok) return;
  assert.match(empty.errors.annotations[0], /needs an explanation/);

  const noPhrase = resolveAnnotations(annotationLines, [{ phrase: '', explanation: 'x' }]);
  assert.equal(noPhrase.ok, false);
});

test('resolveAnnotations accepts an empty list', () => {
  assert.deepEqual(resolveAnnotations(annotationLines, []), { ok: true, annotations: [] });
});
