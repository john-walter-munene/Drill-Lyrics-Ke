import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLyrics, getSong, listSongs } from '../../../api';
import { pageMetadata, songJsonLd } from '../../../lib/seo';
import type { PlayerTrack } from '../../components/player/PlayerProvider';
import SongPlayerView from './SongPlayerView';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const song = await getSong(slug);
  if (!song) return { title: 'Song not found' };
  return pageMetadata({
    title: `${song.title} — ${song.artists.map((a) => a.name).join(', ')}`,
    description: `Lyrics for ${song.title} by ${song.artists.map((a) => a.name).join(', ')} — synchronized on Drill Lyrics.`,
    path: `/songs/${song.slug}`,
    imageUrl: `https://i.ytimg.com/vi/${song.youtubeVideoId}/hqdefault.jpg`,
  });
}

export default async function SongPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [song, lyrics, catalogue] = await Promise.all([
    getSong(slug),
    getLyrics(slug),
    listSongs({ page: 1 }, 0),
  ]);
  if (!song) notFound();
  const queue: PlayerTrack[] = catalogue.items.map((item) => ({
    slug: item.slug,
    title: item.title,
    artistNames: item.artists.map((artist) => artist.name),
    youtubeVideoId: item.youtubeVideoId,
  }));
  if (!queue.some((item) => item.slug === song.slug)) {
    queue.unshift({
      slug: song.slug,
      title: song.title,
      artistNames: song.artists.map((artist) => artist.name),
      youtubeVideoId: song.youtubeVideoId,
    });
  }

  return (
    <main className="container">
      <script
        type="application/ld+json"
        // Structured data is generated server-side from trusted fields only.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            songJsonLd({
              title: song.title,
              slug: song.slug,
              artistNames: song.artists.map((a) => a.name),
              youtubeVideoId: song.youtubeVideoId,
              releaseDate: song.releaseDate,
            }),
          ),
        }}
      />

      <nav aria-label="Breadcrumb" className="muted" style={{ fontSize: '0.85rem' }}>
        <Link href="/songs">Songs</Link> / <span>{song.title}</span>
      </nav>

      <header className="page-head">
        <h1>{song.title}</h1>
        <p className="muted">
          {song.artists.map((a, i) => (
            <span key={a.slug}>
              {i > 0 ? ', ' : ''}
              <Link href={`/artists/${a.slug}`}>{a.name}</Link>
            </span>
          ))}
          {song.featuring.length ? ` feat. ${song.featuring.map((f) => f.name).join(', ')}` : ''}
        </p>
      </header>

      <SongPlayerView song={song} lyrics={lyrics} queue={queue} />
    </main>
  );
}
