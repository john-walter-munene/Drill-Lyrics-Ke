import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <h1>Not found</h1>
      <p className="muted">
        That page is not here. It may have been unpublished, or the link is wrong.
      </p>
      <p style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Link href="/songs" className="btn btn--primary btn--sm">
          Browse songs
        </Link>
        <Link href="/" className="btn btn--sm">
          Home
        </Link>
      </p>
    </main>
  );
}
