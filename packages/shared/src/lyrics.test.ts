import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findActiveLineIndex,
  isSynchronized,
  msToTimestamp,
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
