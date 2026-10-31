
import Link from 'next/link';
import type { Metadata } from 'next';
import { search } from '../../api';
import { pageMetadata } from '../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Search',
  description:
    'Discover Kenyan drill songs, artists, lyrics, DJs, podcasts, and events on Drill Lyrics KE.',
  path: '/search',
});

const groups = [
  { key: 'songs', title: 'Songs', href: (slug: string) => `/songs/${slug}` },
  { key: 'artists', title: 'Artists', href: (slug: string) => `/artists/${slug}` },
  { key: 'djs', title: 'DJs', href: (slug: string) => `/djs/${slug}` },
  { key: 'podcasts', title: 'Podcasts', href: (slug: string) => `/podcasts/${slug}` },
  { key: 'events', title: 'Events', href: (slug: string) => `/events/${slug}` },
] as const;

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const isValidQuery = query.length >= 2;

  const results = await search(query);

  const hasResults = isValidQuery &&
    groups.some(({ key }) => results[key].length > 0);

  return (
    <main className="container search-page">
      <header className="page-head search-page__header">
        <p className="search-page__eyebrow">Explore the scene</p>

        <h1>Find your next discovery.</h1>

        <p className="muted">
          Search Kenyan drill songs, artists, lyrics, DJs, podcasts, and
          events. Find the music, people, and stories shaping the scene.
        </p>
      </header>

      <form method="get" action="/search" className="page-toolbar search-page__form">
        <label htmlFor="q" className="visually-hidden">
          Search songs, artists, lyrics and more
        </label>

        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          minLength={2}
          maxLength={100}
          placeholder="Try a song, artist, or lyric phrase..."
        />

        <button className="btn btn--primary" type="submit">
          Search
        </button>
      </form>

      {!isValidQuery ? (
        <section className="search-page__empty">
          <h2>What are you looking for?</h2>
          <p className="muted">
            Enter at least two characters to search across the Drill
            Lyrics KE catalogue.
          </p>
        </section>
      ) : !hasResults ? (
        <section className="search-page__empty">
          <h2>No results found</h2>
          <p className="muted">
            We couldn't find anything matching &ldquo;{query}&rdquo;.
            Try another song title, artist name, or lyric phrase.
          </p>
          <Link href="/songs" className="btn">
            Browse songs
          </Link>
        </section>
      ) : (
        <div className="search-page__results">
          <p className="muted search-page__result-label">
            Search results for <strong>&ldquo;{query}&rdquo;</strong>
          </p>

          {groups.map(({ key, title, href }) => {
            const items = results[key];

            if (!items.length) return null;

            return (
              <section
                key={key}
                className="search-page__group"
                aria-labelledby={`search-${key}`}
              >
                <h2 id={`search-${key}`}>
                  {title}
                  <span className="search-page__count">
                    {items.length}
                  </span>
                </h2>

                <ul className="search-results">
                  {items.map((item) => (
                    <li className="search-results__item" key={item.slug}>
                      <Link href={href(item.slug)}>
                        <strong>{item.title}</strong>

                        {item.subtitle ? (
                          <span className="muted search-page__subtitle">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}