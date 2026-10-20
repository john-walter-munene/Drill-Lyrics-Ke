import Link from 'next/link';
import type { Metadata } from 'next';
import { listPodcasts } from '../../lib/api';
import { pageMetadata } from '../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Podcasts',
  description: 'The conversations around Kenyan drill — shows, episodes, and the songs they discuss.',
  path: '/podcasts',
});

export const revalidate = 300;

export default async function PodcastsPage() {
  const data = await listPodcasts();

  return (
    <main className="container">
      <h1>Podcasts</h1>
      <p className="muted" style={{ maxWidth: 620 }}>
        Drill TV, audio edition: shows covering the scene, the artists and the bars. Episodes play
        from the creator&apos;s own platform.
      </p>

      {data.items.length === 0 ? (
        <p className="muted">Show listings are being added.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '1rem' }}>
          {data.items.map((podcast) => (
            <li key={podcast.slug} className="panel">
              <Link href={`/podcasts/${podcast.slug}`}>
                <strong>{podcast.title}</strong>
              </Link>
              {podcast.hostName ? (
                <span className="muted"> · {podcast.hostName}</span>
              ) : null}
              <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                {podcast.description ?? `${podcast.episodeCount} episode(s)`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
