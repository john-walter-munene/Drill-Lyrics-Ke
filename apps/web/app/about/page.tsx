import Link from 'next/link';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'About DrillKe',
  description:
    'Why DrillKe exists, how it works, and the rules that keep it honest — metadata not media, community-built and editorially reviewed.',
  path: '/about',
});

export const revalidate = 3600;

const PRINCIPLES = [
  ['The player is the product', 'Every v1 decision serves the play-plus-lyrics experience.'],
  ['Metadata, not media', 'We embed and credit. We never rehost music we do not have rights to.'],
  ['Artists keep their platforms', 'DrillKe sends listeners back to the artist, never replaces them.'],
  ['Honest interfaces', 'We never imply lyrics are synced, or an artist verified, when they are not.'],
  ['Community-built, editorially reviewed', 'Anyone can contribute; nothing publishes without review.'],
  ['Lightweight by design', 'Built for everyday phones on mobile data.'],
];

export default function AboutPage() {
  return (
    <main className="container">
      <h1>About DrillKe</h1>
      <p className="muted" style={{ maxWidth: 680, fontSize: '1.05rem' }}>
        Kenyan drill is more than music — it is language, identity, neighbourhoods and community.
        DrillKe gives a fan one place to follow the bars, understand the meaning, and find the
        people around the sound.
      </p>

      <section style={{ marginTop: '2.5rem', maxWidth: 720 }}>
        <h2>How it works</h2>
        <ol className="muted" style={{ lineHeight: 1.8 }}>
          <li>You open a song. The video plays from the artist&apos;s own channel on YouTube.</li>
          <li>The lyrics highlight line by line as the track plays.</li>
          <li>Tap a phrase to see what the Sheng or the reference means.</li>
          <li>Lyrics come from the community and are reviewed before they publish.</li>
        </ol>
        <p className="muted">
          We do not host audio or video. We store metadata, timing and commentary, and we point
          every play back to the source.
        </p>
      </section>

      <section style={{ marginTop: '2.5rem' }}>
        <h2>What we stand on</h2>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          {PRINCIPLES.map(([title, body]) => (
            <li key={title} className="panel">
              <h3 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>{title}</h3>
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                {body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: '2.5rem', maxWidth: 720 }}>
        <h2>Rights</h2>
        <p className="muted">
          Lyrics are copyrighted works. Artists and rights holders can submit or approve lyrics for
          their own songs, and any rights holder can request a takedown — see{' '}
          <Link href="/legal/rights">Rights &amp; takedowns</Link>. The code is open source; the
          content is not ours to give away.
        </p>
      </section>

      <p style={{ marginTop: '2.5rem' }}>
        <Link href="/support" className="btn btn--primary">
          Support our work
        </Link>
      </p>
    </main>
  );
}
