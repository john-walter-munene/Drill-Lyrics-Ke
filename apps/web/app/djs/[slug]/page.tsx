import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDj } from '../../../lib/api';
import { pageMetadata } from '../../../lib/seo';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dj = await getDj(slug);
  if (!dj) return { title: 'DJ not found' };
  return pageMetadata({
    title: dj.name,
    description: dj.bio ?? `DJ ${dj.name} — tracks, mixes and appearances on DrillKe.`,
    path: `/djs/${dj.slug}`,
  });
}

export default async function DjPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dj = await getDj(slug);
  if (!dj) notFound();

  return (
    <main className="container">
      <h1 style={{ marginBottom: '0.25rem' }}>{dj.name}</h1>
      {dj.city ? <p className="muted" style={{ marginTop: 0 }}>{dj.city}</p> : null}
      {dj.bio ? (
        <p className="muted" style={{ maxWidth: 680 }}>
          {dj.bio}
        </p>
      ) : null}

      {dj.links.length ? (
        <p style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1rem 0 2rem' }}>
          {dj.links.map((link) => (
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

      <h2 style={{ fontSize: '1.1rem' }}>Spins</h2>
      {dj.tracks.length === 0 ? (
        <p className="muted">No tracks listed yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
          {dj.tracks.map((track) => (
            <li key={track.slug} className="panel">
              <Link href={`/songs/${track.slug}`}>
                <strong>{track.title}</strong>
              </Link>
              {track.artistNames.length ? (
                <span className="muted"> · {track.artistNames.join(', ')}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
