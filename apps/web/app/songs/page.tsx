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
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1) || 1;
  const data = await listSongs({ q: params.q, page });

  return (
    <main className="container">
      <header className="page-head">
        <h1>Songs</h1>
        <p className="muted">
          Every published song in the catalogue. Play one here, or open it to read the bars.
        </p>
      </header>

      <form method="get" className="page-toolbar">
        <label htmlFor="song-search" className="muted">
          Search
        </label>
        <input id="song-search" name="q" defaultValue={params.q ?? ''} placeholder="Title or artist" />
        <button type="submit" className="btn btn--primary btn--sm">
          Go
        </button>
      </form>

      {data.items.length === 0 ? (
        <p className="muted">
          No songs here yet. The catalogue is being built — <Link href="/submit">contribute the first one</Link>.
        </p>
      ) : (
        <SongList songs={data.items} />
      )}
    </main>
  );
}
