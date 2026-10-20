import Link from 'next/link';
import type { Metadata } from 'next';
import { listDjs } from '../../lib/api';
import { pageMetadata } from '../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'DJs',
  description: 'The DJs moving Kenyan drill — profiles, mixes and the tracks they spin.',
  path: '/djs',
});

export const revalidate = 300;

export default async function DjsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const data = await listDjs({ city: params.city });

  return (
    <main className="container">
      <h1>DJs</h1>
      <p className="muted" style={{ maxWidth: 620 }}>
        The people moving the scene. Mixes stay on the DJ&apos;s own platform — we link out and
        credit them.
      </p>

      {data.items.length === 0 ? (
        <p className="muted">The DJ directory is being built.</p>
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
          {data.items.map((dj) => (
            <li key={dj.slug} className="panel">
              <Link href={`/djs/${dj.slug}`}>
                <strong>{dj.name}</strong>
              </Link>
              {dj.city ? (
                <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                  {dj.city}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
