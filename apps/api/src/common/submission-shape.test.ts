import assert from 'node:assert/strict';
import { test } from 'node:test';
import { looksLikeMarkdownDocument } from './submission-shape.ts';

test('a leading --- fence marks a Markdown document', () => {
  assert.equal(looksLikeMarkdownDocument('---\ntitle: "T"\n---\n\nline'), true);
  assert.equal(looksLikeMarkdownDocument('---  \ntitle: "T"\n---\n\nline'), true);
});

test('the one-line-per-row form is not mistaken for Markdown', () => {
  assert.equal(looksLikeMarkdownDocument('[00:12.500] first line'), false);
  assert.equal(looksLikeMarkdownDocument('plain lyrics\nmore lyrics'), false);
  // A horizontal rule later in the text is not frontmatter.
  assert.equal(looksLikeMarkdownDocument('first line\n---\nsecond line'), false);
  assert.equal(looksLikeMarkdownDocument(''), false);
});
