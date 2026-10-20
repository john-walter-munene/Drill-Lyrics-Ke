import Link from 'next/link';
import type { Metadata } from 'next';
import { listSongs } from '../../lib/api';
import { pageMetadata } from '../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Songs',
  description: 'Browse the DrillKe catalogue — every song with lyrics, context and a play button.',
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
      <h1>Songs</h1>
      <form method="get" style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0 2rem' }}>
        <label htmlFor="song-search" className="muted" style={{ alignSelf: 'center' }}>
          Search
        </label>
        <input
          id="song-search"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Title or artist"
          style={{
            flex: 1,
            maxWidth: 360,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--fg)',
            borderRadius: 8,
            padding: '0.5rem 0.65rem',
          }}
        />
        <button type="submit" className="btn btn--primary btn--sm">
          Go
        </button>
      </form>

      {data.items.length === 0 ? (
        <p className="muted">
          No songs here yet. The catalogue is being built — <Link href="/submit">contribute the first one</Link>.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
          {data.items.map((song) => (
            <li key={song.slug} className="panel">
              <Link href={`/songs/${song.slug}`}>
                <strong>{song.title}</strong>
              </Link>
              <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                {song.artists.map((a) => a.name).join(', ')}
                {song.lyrics.versionId ? (
                  <span className="badge" style={{ marginLeft: '0.5rem' }}>
                    {song.lyrics.syncStatus === 'synchronized' ? 'Synced' : 'Lyrics'}
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
