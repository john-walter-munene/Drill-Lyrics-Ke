/**
 * Search relevance scoring, as a pure function.
 *
 * The MVP search is a case-insensitive substring match across a few columns
 * (`search.service.ts`). That is deliberately cheap — no extra extension, no
 * index rebuild, no ranking service — but it returns results in whatever order
 * the database happened to pick, so a query for "masicka" can put a song whose
 * *lyrics* mention the name above the artist actually called Masicka.
 *
 * This module fixes that ordering without changing what matches. It is kept
 * pure and separate so the tiers are testable without a database, and so the
 * SQL stays a plain Prisma query.
 *
 * Tiers, highest first:
 *   1. exact title/name          "masicka"            → 100
 *   2. title starts with the q   "masicka update"     → 80
 *   3. any word starts with q    "the masicka tape"   → 60
 *   4. title contains q          "imasicka remix"     → 40
 *   5. the title does not match at all; only a      → 10
 *      secondary column does (lyrics, bio, venue)
 *
 * A body-only match is weaker than a mid-word title match on purpose: the user
 * typed a name, and a title that contains it is more likely what they meant
 * than a lyric line that happens to mention it.
 *
 * Ties break on the caller's secondary order (release date, name, start date),
 * so the list stays stable between identical requests.
 */

export type MatchField = 'title' | 'body';

export interface Scorable {
  /** The primary display string: a song title, artist name, event title. */
  title: string;
  /** Secondary fields that also matched — lyrics, bio, host, venue, city. */
  body?: Array<string | null | undefined>;
}

/** Score one record against the query. Returns 0 when it does not match at all. */
export function relevanceScore(item: Scorable, query: string): number {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return 0;
  const title = item.title.toLocaleLowerCase();

  if (title === q) return 100;
  if (title.startsWith(q)) return 80;

  // Word-start match: "kas" should rank "Kas the Goat" above "Alkaskaz".
  // `\p{L}`/`\p{N}` split on Unicode letters and digits, so a mixed
  // Swahili/Sheng/Latin title (`Ẹ ka jo`, `Lil-Kejani`) parses correctly.
  const words = title.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.some((word) => word.startsWith(q))) return 60;
  if (title.includes(q)) return 40;

  const inBody = (item.body ?? []).some((value) => value?.toLocaleLowerCase().includes(q));
  return inBody ? 10 : 0;
}

/**
 * Sort by relevance, then by the caller's prior order.
 *
 * `Array.prototype.sort` is stable, so passing the already-ordered list keeps
 * the database's secondary ordering inside each tier. The input is copied, so
 * a caller cannot be surprised by its own array being reordered.
 */
export function rankByRelevance<T extends Scorable>(items: readonly T[], query: string): T[] {
  return [...items].sort((a, b) => relevanceScore(b, query) - relevanceScore(a, query));
}
