import Link from 'next/link';
import type { Metadata } from 'next';
import { listSongs } from '../../api';
import { pageMetadata } from '../../lib/seo';
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
  searchParams: Promise<{ q?: string; page?: string; artist?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1) || 1;
  const data = await listSongs({ q: params.q, page, artist: params.artist });
  const pageHref = (target: number) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.artist) qs.set('artist', params.artist);
    if (target > 1) qs.set('page', String(target));
    const suffix = qs.toString();
    return suffix ? `/songs?${suffix}` : '/songs';
  };

  return (
    <main className="container">
      <header className="page-head">
        <h1>Songs</h1>
        <p className="muted">
          {params.artist
            ? `${data.total} song${data.total === 1 ? '' : 's'} by this artist. Play one here, or open it to read the bars.`
            : 'Every published song in the catalogue. Play one here, or open it to read the bars.'}
        </p>
      </header>

      <form method="get" className="page-toolbar">
        <label htmlFor="song-search" className="muted">
          Search
        </label>
        <input id="song-search" name="q" defaultValue={params.q ?? ''} placeholder="Title or artist" />
        {params.artist ? <input type="hidden" name="artist" value={params.artist} /> : null}
        <button type="submit" className="btn btn--primary btn--sm">
          Go
        </button>
        {params.artist ? <Link className="btn btn--sm" href="/songs">All songs</Link> : null}
      </form>

      {data.items.length === 0 ? (
        <p className="muted">
          {params.artist
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
