import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getArtist, listSongs } from '../../../api';
import { artistJsonLd, pageMetadata } from '../../../lib/seo';
import SongList from '../../songs/SongList';

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
    description: artist.bio ?? `Kenyan drill artist ${artist.name} — songs, lyrics and links on Drill Lyrics.`,
    path: `/artists/${artist.slug}`,
  });
}

export default async function ArtistPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam ?? 1) || 1;
  const [artist, songs] = await Promise.all([getArtist(slug), listSongs({ artist: slug, page })]);
  if (!artist) notFound();
  // A synced channel can hold hundreds of uploads, so the page cannot stop at
  // the first 20: the rest of the catalogue has to be reachable from here.
  const pageHref = (target: number) => (target <= 1 ? `/artists/${slug}` : `/artists/${slug}?page=${target}`);

  return (
    <main className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(artistJsonLd(artist)),
        }}
      />

      <header className="page-head">
        <h1>
          {artist.name}{' '}
          {artist.verified ? <span className="badge">Verified</span> : null}
        </h1>
      </header>
      {artist.bio ? <p className="muted" style={{ maxWidth: 680 }}>{artist.bio}</p> : null}

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

      <h2 className="page-section" style={{ fontSize: '1.1rem' }}>
        Songs{songs.total ? <span className="muted" style={{ fontWeight: 400 }}> · {songs.total}</span> : null}
      </h2>
      {songs.items.length === 0 ? (
        <p className="muted">
          {artist.youtubeChannelId
            ? 'Their catalogue is being imported — songs appear here as they are read from the channel.'
            : 'No songs in the catalogue yet.'}
        </p>
      ) : (
        <SongList songs={songs.items} />
      )}

      {songs.totalPages > 1 ? (
        <nav aria-label="Catalogue pages" className="page-toolbar" style={{ marginTop: '1.25rem' }}>
          {songs.page > 1 ? <Link className="btn btn--sm" href={pageHref(songs.page - 1)}>← Previous</Link> : null}
          <span className="muted">
            Page {songs.page} of {songs.totalPages}
          </span>
          {songs.page < songs.totalPages ? <Link className="btn btn--sm" href={pageHref(songs.page + 1)}>Next →</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}
