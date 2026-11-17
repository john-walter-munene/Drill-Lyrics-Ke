import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { catalogueSearchParams, parseCatalogueQuery, type CatalogueQuery } from '@drillke/shared';
import { getArtist, listSongs } from '../../../api';
import { artistJsonLd, pageMetadata } from '../../../lib/seo';
import SongFilters from '../../songs/SongFilters';
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
  searchParams: Promise<{ page?: string; sync?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const raw = await searchParams;
  const query = readQuery(raw);
  const [artist, songs] = await Promise.all([
    getArtist(slug),
    listSongs({ ...query, artist: slug }),
  ]);
  if (!artist) notFound();

  // A synced channel can hold hundreds of uploads, so the page cannot stop at
  // the first 20: the rest of the catalogue has to be reachable from here, and
  // a filtered page has to keep its filter while paging.
  const pageHref = (target: number) => {
    const qs = catalogueSearchParams({ ...query, artist: slug, page: target });
    return qs ? `/artists/${slug}?${qs}` : `/artists/${slug}`;
  };

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

      <SongFilters basePath={`/artists/${slug}`} query={query} total={songs.total} />

      {songs.items.length === 0 ? (
        <p className="muted">
          {query.sync === 'synced'
            ? 'None of their songs are synchronized yet. Switch to "Not yet" to see what is waiting for timing.'
            : query.sync === 'unsynced'
              ? 'Every one of their published songs is synchronized. Switch to "Synchronized" to read along.'
              : artist.youtubeChannelId
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

/** Same contract as `/songs`; an illegal value falls back to the default order. */
function readQuery(params: { page?: string; sync?: string; sort?: string }): CatalogueQuery {
  const parsed = parseCatalogueQuery(params);
  if (parsed.ok) return parsed.query;
  const page = Number(params.page ?? 1);
  return { sort: 'newest', page: page > 0 ? page : 1 };
}