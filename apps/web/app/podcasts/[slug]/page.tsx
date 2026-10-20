import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPodcast } from '../../../lib/api';
import { pageMetadata } from '../../../lib/seo';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const podcast = await getPodcast(slug);
  if (!podcast) return { title: 'Podcast not found' };
  return pageMetadata({
    title: podcast.title,
    description: podcast.description ?? `Episodes of ${podcast.title} on DrillKe.`,
    path: `/podcasts/${podcast.slug}`,
  });
}

export default async function PodcastPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const podcast = await getPodcast(slug);
  if (!podcast) notFound();

  return (
    <main className="container">
      <h1 style={{ marginBottom: '0.25rem' }}>{podcast.title}</h1>
      {podcast.hostName ? <p className="muted" style={{ marginTop: 0 }}>Hosted by {podcast.hostName}</p> : null}
      {podcast.description ? <p className="muted" style={{ maxWidth: 680 }}>{podcast.description}</p> : null}

      <h2 style={{ fontSize: '1.1rem', marginTop: '2rem' }}>Episodes</h2>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Episode lists are wired up in Phase 3 — see docs/roadmap.md. Published episodes will appear
        here, newest first.
      </p>
    </main>
  );
}
