import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getEvent } from '../../../lib/api';
import { eventJsonLd, pageMetadata } from '../../../lib/seo';
import { formatEventTime } from '../../../lib/format';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: 'Event not found' };
  return pageMetadata({
    title: event.title,
    description: `${event.title} — ${event.city}${event.venue ? `, ${event.venue}` : ''}. Lineup, time and tickets.`,
    path: `/events/${event.slug}`,
  });
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  return (
    <main className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            eventJsonLd({
              title: event.title,
              slug: event.slug,
              startsAt: event.startsAt,
              venue: event.venue,
              city: event.city,
            }),
          ),
        }}
      />

      <nav aria-label="Breadcrumb" className="muted" style={{ fontSize: '0.85rem' }}>
        <Link href="/events">Events</Link> / <span>{event.title}</span>
      </nav>

      <h1 style={{ marginBottom: '0.25rem' }}>{event.title}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {formatEventTime(event.startsAt)}
        {event.venue ? ` · ${event.venue}` : ''} · {event.city}
      </p>

      {event.description ? <p style={{ maxWidth: 680 }}>{event.description}</p> : null}

      <section className="panel" style={{ marginTop: '1.5rem', maxWidth: 680 }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Lineup</h2>
        {event.lineup.artists.length === 0 && event.lineup.djs.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Lineup to be announced.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.9 }}>
            {event.lineup.artists.map((artist) => (
              <li key={`artist-${artist.slug}`}>
                <Link href={`/artists/${artist.slug}`}>{artist.name}</Link> <span className="badge">Artist</span>
              </li>
            ))}
            {event.lineup.djs.map((dj) => (
              <li key={`dj-${dj.slug}`}>
                <Link href={`/djs/${dj.slug}`}>{dj.name}</Link> <span className="badge">DJ</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {event.ticketUrl ? (
        <p style={{ marginTop: '1.5rem' }}>
          <a href={event.ticketUrl} className="btn btn--primary" target="_blank" rel="noopener noreferrer nofollow">
            Tickets{event.ticketPrice ? ` · ${event.ticketPrice}` : ''} ↗
          </a>
        </p>
      ) : null}
    </main>
  );
}
