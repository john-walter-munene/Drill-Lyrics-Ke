import Link from 'next/link';
import type { Metadata } from 'next';
import { listArtists } from '../../api';
import { pageMetadata } from '../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Artists',
  description: 'Kenyan drill artists on Drill Lyrics — profiles, links and catalogue.',
  path: '/artists',
});

export const revalidate = 300;

export default async function ArtistsPage() {
  const data = await listArtists();

  return (
    <main className="container">
      <header className="page-head">
        <h1>Artists</h1>
        <p className="muted">
          Kenyan drill artists in the catalogue, with their releases and their own channels.
        </p>
      </header>

      {data.items.length === 0 ? (
        <p className="muted">
          Artist profiles are being added. Know someone who belongs here?{' '}
          <Link href="/submit">Submit their song</Link>.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {data.items.map((artist) => (
            <li key={artist.slug} className="panel">
              <Link href={`/artists/${artist.slug}`}>
                <strong>{artist.name}</strong>
              </Link>
              {artist.verified ? (
                <span className="badge" style={{ marginLeft: '0.5rem' }}>
                  Verified
                </span>
              ) : null}
              <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                {artist.songCount} song{artist.songCount === 1 ? '' : 's'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
