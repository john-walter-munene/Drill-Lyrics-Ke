import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyUpload, parseIsoDuration } from './youtube-classify.ts';

/**
 * The classifier decides what enters the catalogue, so the cases below are the
 * real shapes a Kenyan drill channel's uploads take — not invented ones.
 */

test('a music-category song is audio', () => {
  const result = classifyUpload({ title: 'NastyGoat - Strap (Official Music Video)', durationSeconds: 198, category: 'Music' });
  assert.equal(result.kind, 'audio');
  assert.ok(result.score >= 0.5);
});

test('a Topic channel track is audio even without a category', () => {
  const result = classifyUpload({ title: 'Strap', durationSeconds: 198, topicChannel: true });
  assert.equal(result.kind, 'audio');
});

test('a document with a song-length run time is only a video candidate', () => {
  const result = classifyUpload({ title: 'Our new studio', durationSeconds: 240, category: 'Entertainment' });
  assert.equal(result.kind, 'video');
});

test('a teaser in the title is not audio', () => {
  const result = classifyUpload({ title: 'Next single (Teaser)', durationSeconds: 60, category: 'Music' });
  assert.notEqual(result.kind, 'audio');
});

test('shorts, live streams and clips under 45 seconds are rejected', () => {
  assert.equal(classifyUpload({ title: 'Verse #shorts', durationSeconds: 30, category: 'Music' }).kind, 'rejected');
  assert.equal(classifyUpload({ title: 'Listening party', durationSeconds: 3600, category: 'Music', liveBroadcastContent: 'live' }).kind, 'rejected');
  assert.equal(classifyUpload({ title: 'Out now', durationSeconds: 20, category: 'Music' }).kind, 'rejected');
});

test('a long interview is not audio', () => {
  const result = classifyUpload({ title: 'Full interview with the crew', durationSeconds: 2700, category: 'Entertainment' });
  assert.notEqual(result.kind, 'audio');
  assert.ok(result.reasons.some((reason) => reason.includes('non-music')));
});

test('ISO-8601 durations from the Data API are parsed', () => {
  assert.equal(parseIsoDuration('PT3M18S'), 198);
  assert.equal(parseIsoDuration('PT1H2M3S'), 3723);
  assert.equal(parseIsoDuration('P1DT1S'), 86_401);
  assert.equal(parseIsoDuration('not-a-duration'), null);
  assert.equal(parseIsoDuration(undefined), null);
});

/*
 * Real channel shapes, taken from the Wakadinali import of 31 October 2026:
 * 131 correct songs, plus the uploads a name list and category alone put in
 * the public catalogue by mistake.
 */

test('an event caption is not a release, even tagged Music', () => {
  // Caption (-0.5) still nets +0.3 against the Music category alone, so the
  // verdict is "video" — not "audio". Either way it stays out of the public
  // catalogue and waits in Song imports.
  const result = classifyUpload({ title: 'VOM2OUR PLEASE JOIN US ON THE 11th #VOM2 #Wakadinali', durationSeconds: 41, category: 'Music' });
  assert.notEqual(result.kind, 'audio');
  assert.ok(result.reasons.includes('social media caption'));
});

test('a normal drill title keeps its category verdict', () => {
  const result = classifyUpload({ title: 'Wakadinali - "Sharara" (Official Video)', durationSeconds: 201, category: 'Music' });
  assert.equal(result.kind, 'audio');
});

test('a ten-minute freestyle is still a song, not a long run', () => {
  const result = classifyUpload({ title: 'Wakadinali - Freestyle (720 Cypher)', durationSeconds: 640, category: 'Music' });
  assert.equal(result.kind, 'audio');
});

test('a 30-second clip is the shortest accepted release', () => {
  // Music category (0.5) + song-length run time (0.3) is what makes audio.
  assert.equal(classifyUpload({ title: 'Intro', durationSeconds: 31, category: 'Music' }).kind, 'audio');
  assert.equal(classifyUpload({ title: 'Intro', durationSeconds: 29, category: 'Music' }).kind, 'rejected');
});

test('a festival or a live-set recording is not a release', () => {
  assert.notEqual(classifyUpload({ title: 'RYMGYM Festival', durationSeconds: 95, category: 'Music' }).kind, 'audio');
  assert.notEqual(classifyUpload({ title: 'WAKADINALI - "RONG EXPERIENCE" LIVE PART 1', durationSeconds: 1450, category: 'Music' }).kind, 'audio');
});
