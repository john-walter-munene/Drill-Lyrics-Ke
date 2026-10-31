import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankByRelevance, relevanceScore } from './relevance.ts';

test('tiers order exact, prefix, word-start, substring, body', () => {
  const query = 'masicka';
  const exact = relevanceScore({ title: 'Masicka' }, query);
  const prefix = relevanceScore({ title: 'Masicka Update' }, query);
  const wordStart = relevanceScore({ title: 'The Masicka Tape' }, query);
  // A mid-word hit, not a word start: "massicka" inside one word.
  const substring = relevanceScore({ title: 'Xmasicka Remix' }, query);
  const bodyOnly = relevanceScore({ title: 'Update', body: ['a tribute to Masicka'] }, query);

  assert.ok(exact > prefix, `${exact} > ${prefix}`);
  assert.ok(prefix > wordStart, `${prefix} > ${wordStart}`);
  assert.ok(wordStart > substring, `${wordStart} > ${substring}`);
  assert.ok(substring > bodyOnly, `${substring} > ${bodyOnly}`);
  assert.ok(bodyOnly > 0);
});

test('matching is case-insensitive in both directions', () => {
  assert.equal(relevanceScore({ title: 'MAsicka' }, 'masicka'), 100);
  assert.equal(relevanceScore({ title: 'masicka' }, 'MAsicka'), 100);
});

test('a non-matching record scores zero', () => {
  assert.equal(relevanceScore({ title: 'Gengetone Anthem', body: ['party'] }, 'masicka'), 0);
});

test('an empty query scores zero rather than matching everything', () => {
  assert.equal(relevanceScore({ title: 'Anything' }, ''), 0);
  assert.equal(relevanceScore({ title: 'Anything' }, '   '), 0);
});

test('punctuation and digits split words correctly', () => {
  // A hyphen is a word boundary, not part of the word. The final-digit check
  // keeps the prefix tier from swallowing a legitimate word-start match.
  assert.equal(relevanceScore({ title: 'Lil-Kejani Flow' }, 'kejani'), 60);
  // Starts the title, so the prefix tier applies even though the apostrophe is
  // a boundary — prefix is checked before the word split.
  assert.equal(relevanceScore({ title: "Mwana's Anthem" }, 'mwana'), 80);
  // Mid-title, the apostrophe still separates words.
  assert.equal(relevanceScore({ title: "Big Mwana's Anthem" }, 'mwana'), 60);
  // At the start of the title, so the prefix tier wins over word-start.
  assert.equal(relevanceScore({ title: '44 Drill' }, '44'), 80);
  // Same word start, but at the very beginning of the title: the prefix tier.
  assert.equal(relevanceScore({ title: 'Kejani Flow' }, 'kejani'), 80);
});

test('a non-Latin title does not crash the word split', () => {
  // Sheng mixes scripts; the split uses Unicode properties rather than \w.
  assert.equal(relevanceScore({ title: 'Ẹ ka jo' }, 'ka'), 60);
});

test('rankByRelevance puts the best match first and keeps ties stable', () => {
  const items = [
    { title: 'Update', body: ['a tribute to Masicka'], id: 1 },
    { title: 'Masicka Update', id: 2 },
    { title: 'Masicka', id: 3 },
    { title: 'Another Song', id: 4 },
  ];
  const ranked = rankByRelevance(items, 'masicka');

  assert.equal(ranked[0].id, 3, 'exact title first');
  assert.equal(ranked[1].id, 2, 'then the prefix match');
  // A record that matches in no column scores 0 and sorts last; the body-only
  // match outranks it.
  assert.equal(ranked[2].id, 1, 'body-only match above no-match');
  assert.equal(ranked[3].id, 4, 'no match last');
});

test('a title hit always beats a body-only hit', () => {
  // The case this whole module exists for: a lyric line that mentions the
  // artist must not outrank the artist\'s own song.
  const items = [
    { title: 'Some Other Track', body: ['shout out Masicka'], id: 'lyric-mention' },
    { title: 'Masicka Update', id: 'real-song' },
  ];
  assert.equal(rankByRelevance(items, 'masicka')[0].id, 'real-song');
});

test('ranking is stable for equal scores', () => {
  const items = [
    { title: 'Masicka A', id: 'a' },
    { title: 'Masicka B', id: 'b' },
    { title: 'Masicka C', id: 'c' },
  ];
  const first = rankByRelevance(items, 'masicka').map((item) => item.id);
  const second = rankByRelevance(items, 'masicka').map((item) => item.id);
  assert.deepEqual(first, second);
  assert.deepEqual(first, ['a', 'b', 'c'], 'same-tier items keep the incoming order');
});

test('ranking does not mutate the input array', () => {
  const items = [{ title: 'b' }, { title: 'a' }];
  const copy = [...items];
  rankByRelevance(items, 'a');
  assert.deepEqual(items, copy);
});
