
import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      className="container"
      style={{ maxWidth: 600, paddingTop: '5rem', paddingBottom: '5rem' }}
    >
      <section className="panel" style={{ padding: '2rem' }}>
        <p className="muted" style={{ fontWeight: 700, letterSpacing: '0.15em' }}>
          DRILL LYRICS KE · 404
        </p>

        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>
          Page not found.
        </h1>

        <p className="muted" style={{ lineHeight: 1.8 }}>
          The page you&apos;re looking for doesn&apos;t exist or may no
          longer be available. Check the link or return to the homepage
          to continue exploring Drill Lyrics KE.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginTop: '1.5rem',
          }}
        >
          <Link href="/" className="btn btn--primary">
            Back home
          </Link>

          <Link href="/songs" className="btn">
            Explore songs
          </Link>

          <Link href="/artists" className="btn">
            Discover artists
          </Link>
        </div>
      </section>
    </main>
  );
}