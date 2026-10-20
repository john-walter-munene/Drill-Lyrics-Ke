import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getArtist, listSongs } from '../../../lib/api';
import { artistJsonLd, pageMetadata } from '../../../lib/seo';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) return { title: 'Artist not found' };
  return pageMetadata({
    title: artist.name,
    description: artist.bio ?? `Kenyan drill artist ${artist.name} — songs, lyrics and links on DrillKe.`,
    path: `/artists/${artist.slug}`,
  });
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [artist, songs] = await Promise.all([getArtist(slug), listSongs({ artist: slug })]);
  if (!artist) notFound();

  return (
    <main className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(artistJsonLd(artist)),
        }}
      />

      <h1 style={{ marginBottom: '0.25rem' }}>
        {artist.name}{' '}
        {artist.verified ? <span className="badge">Verified</span> : null}
      </h1>
      {artist.bio ? (
        <p className="muted" style={{ maxWidth: 680 }}>
          {artist.bio}
        </p>
      ) : null}

      {artist.links.length ? (
        <p style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1rem 0 2rem' }}>
          {artist.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              className="btn btn--sm"
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              {link.label} ↗
            </a>
          ))}
        </p>
      ) : null}

      <h2 style={{ fontSize: '1.1rem' }}>Songs</h2>
      {songs.items.length === 0 ? (
        <p className="muted">No songs in the catalogue yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
          {songs.items.map((song) => (
            <li key={song.slug} className="panel">
              <Link href={`/songs/${song.slug}`}>
                <strong>{song.title}</strong>
              </Link>
              {song.lyrics.versionId ? (
                <span className="badge" style={{ marginLeft: '0.5rem' }}>
                  {song.lyrics.syncStatus === 'synchronized' ? 'Synced' : 'Lyrics'}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
