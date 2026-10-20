import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLyrics, getSong } from '../../../lib/api';
import { pageMetadata, songJsonLd } from '../../../lib/seo';
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
    description: `Lyrics for ${song.title} by ${song.artists.map((a) => a.name).join(', ')} — synchronized on DrillKe.`,
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
  const [song, lyrics] = await Promise.all([getSong(slug), getLyrics(slug)]);
  if (!song) notFound();

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

      <h1 style={{ marginBottom: '0.25rem' }}>{song.title}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {song.artists.map((a, i) => (
          <span key={a.slug}>
            {i > 0 ? ', ' : ''}
            <Link href={`/artists/${a.slug}`}>{a.name}</Link>
          </span>
        ))}
        {song.featuring.length ? ` feat. ${song.featuring.map((f) => f.name).join(', ')}` : ''}
      </p>

      <SongPlayerView song={song} lyrics={lyrics} />
    </main>
  );
}
