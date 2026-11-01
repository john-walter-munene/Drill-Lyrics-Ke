/**
 * Which parser a submission body needs.
 *
 * A submission is either a Markdown document (`docs/lyrics-format.md` §1) or the
 * one-line-per-row text form. The two are validated differently — a Markdown
 * document must carry frontmatter, a text body must not — so the server has to
 * decide which rules apply before parsing.
 *
 * Kept as a leaf module so it can be unit-tested without booting Nest: the
 * service that uses it has constructor parameter properties, which the test
 * runner's strip-only TypeScript mode cannot execute.
 */

/**
 * True when the body opens with a `---` frontmatter fence.
 *
 * Only the **first** line counts: a horizontal rule further down is ordinary
 * lyric text, and treating it as frontmatter would reject a valid submission.
 */
export function looksLikeMarkdownDocument(body: string): boolean {
  const firstLine = (body.split('\n')[0] ?? '').trim();
  return firstLine === '---';
}
