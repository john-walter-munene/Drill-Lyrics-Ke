import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata } from '../../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Rights & takedowns',
  description: 'How DrillKe handles copyright, artist permissions and takedown requests.',
  path: '/legal/rights',
});

export default function RightsPage() {
  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <h1>Rights &amp; takedowns</h1>
      <p className="muted">
        Lyrics are copyrighted works. DrillKe publishes them only where an artist, writer or rights
        holder has granted permission, or under a policy that allows prompt removal on request.
      </p>

      <h2>If you are a rights holder</h2>
      <ol className="muted" style={{ lineHeight: 1.9 }}>
        <li>Tell us which song and which version (a link is enough).</li>
        <li>We unpublish first and review second — the content comes down while we look.</li>
        <li>We record the request and the outcome.</li>
      </ol>

      <h2>If you are an artist</h2>
      <p className="muted">
        You can submit or approve lyrics for your own songs, and ask us to correct or remove
        anything about your catalogue. Start from{' '}
        <Link href="/submit">Submit lyrics</Link>.
      </p>

      <h2>About the code</h2>
      <p className="muted">
        DrillKe&apos;s source is open. The licence covers the code only — never the lyrics, artwork
        or artist names.
      </p>
    </main>
  );
}
