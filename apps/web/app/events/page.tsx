import Link from 'next/link';
import type { Metadata } from 'next';
import { listEvents } from '../../api';
import { pageMetadata } from '../../lib/seo';
import { formatEventTime } from '../../lib/format';

export const metadata: Metadata = pageMetadata({
  title: 'Events',
  description: 'Drill events across Kenya — lineups, venues and tickets from the organisers.',
  path: '/events',
});

export const revalidate = 120;

export default async function EventsPage() {
  const data = await listEvents();

  return (
    <main className="container">
      <header className="page-head">
        <h1>Events</h1>
        <p className="muted">
          Where to catch drill live. Tickets are sold by the organisers — we only point you to them.
        </p>
      </header>

      {data.items.length === 0 ? (
        <p className="muted">No events listed yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '1rem' }}>
          {data.items.map((event) => (
            <li key={event.slug} className="panel">
              <Link href={`/events/${event.slug}`}>
                <strong>{event.title}</strong>
              </Link>
              <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                {formatEventTime(event.startsAt)} · {event.venue ?? 'Venue TBA'}, {event.city}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
