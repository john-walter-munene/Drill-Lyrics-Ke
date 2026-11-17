import Link from 'next/link';
import type { Metadata } from 'next';
import {
  catalogueSearchParams,
  parseCatalogueQuery,
  type CatalogueQuery,
} from '@drillke/shared';
import { listSongs } from '../../api';
import { pageMetadata } from '../../lib/seo';
import SongFilters from './SongFilters';
import SongList from './SongList';

export const metadata: Metadata = pageMetadata({
  title: 'Songs',
  description: 'Browse the Drill Lyrics catalogue — every song with lyrics, context and a play button.',
  path: '/songs',
});

export const revalidate = 120;

export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; artist?: string; sync?: string; language?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const query = readQuery(params);
  const data = await listSongs(query);

  const pageHref = (target: number) => {
    const qs = catalogueSearchParams({ ...query, page: target });
    return qs ? `/songs?${qs}` : '/songs';
  };

  return (
    <main className="container">
      <header className="page-head">
        <h1>Songs</h1>
        <p className="muted">
          {query.artist
            ? `${data.total} song${data.total === 1 ? '' : 's'} by this artist. Play one here, or open it to read the bars.`
            : 'Every published song in the catalogue. Play one here, or open it to read the bars.'}
        </p>
      </header>

      <form method="get" className="page-toolbar">
        <label htmlFor="song-search" className="muted">
          Search
        </label>
        <input id="song-search" name="q" defaultValue={query.q ?? ''} placeholder="Title or artist" />
        {/* Every filter travels with the search, so searching inside
            "synchronized, newest first" does not reset the catalogue. */}
        {query.artist ? <input type="hidden" name="artist" value={query.artist} /> : null}
        {query.sync ? <input type="hidden" name="sync" value={query.sync} /> : null}
        {query.language ? <input type="hidden" name="language" value={query.language} /> : null}
        {query.sort !== 'newest' ? <input type="hidden" name="sort" value={query.sort} /> : null}
        <button type="submit" className="btn btn--primary btn--sm">
          Go
        </button>
        {query.artist ? <Link className="btn btn--sm" href="/songs">All songs</Link> : null}
      </form>

      <SongFilters basePath="/songs" query={query} total={data.total} />

      {data.items.length === 0 ? (
        <p className="muted">
          {query.sync === 'synced'
            ? query.artist
              ? 'None of this artist\'s songs are synchronized yet. Switch to "Not yet" to see what is waiting for timing.'
              : 'No synchronized songs match this view yet. Switch to "Not yet" to see what is waiting for timing.'
            : query.artist
              ? 'Nothing published here yet — this artist\'s imported songs appear as they are read from their channel.'
              : <>No songs here yet. The catalogue is being built — <Link href="/submit">contribute the first one</Link>.</>}
        </p>
      ) : (
        <SongList songs={data.items} />
      )}

      {data.totalPages > 1 ? (
        <nav aria-label="Catalogue pages" className="page-toolbar" style={{ marginTop: '1.25rem' }}>
          {data.page > 1 ? <Link className="btn btn--sm" href={pageHref(data.page - 1)}>← Previous</Link> : null}
          <span className="muted">
            Page {data.page} of {data.totalPages} · {data.total} songs
          </span>
          {data.page < data.totalPages ? <Link className="btn btn--sm" href={pageHref(data.page + 1)}>Next →</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}

/**
 * Parse with the API's own contract. An illegal value is ignored here and
 * refused by the API — this page renders a readable catalogue either way, but
 * it never invents a sort the contract does not define.
 */
function readQuery(params: { q?: string; page?: string; artist?: string; sync?: string; language?: string; sort?: string }): CatalogueQuery {
  const parsed = parseCatalogueQuery(params);
  if (parsed.ok) return parsed.query;
  return {
    sort: 'newest',
    page: Number(params.page ?? 1) > 0 ? Number(params.page ?? 1) : 1,
    ...(params.q?.trim() ? { q: params.q.trim() } : {}),
    ...(params.artist?.trim() ? { artist: params.artist.trim() } : {}),
  };
}