import Link from 'next/link';
import { pageMetadata } from '../lib/seo';

export const metadata = pageMetadata({
  title: 'DrillKe — Kenyan drill lyrics, synchronized',
  description:
    'The home of Kenyan drill. Read the bars while the music plays — synchronized lyrics, Sheng annotations, artists, DJs, podcasts and events.',
  path: '/',
});

const SECTIONS = [
  { href: '/songs', title: 'Songs', blurb: 'Browse the catalogue and follow the bars.' },
  { href: '/artists', title: 'Artists', blurb: 'Profiles, links and every release in one place.' },
  { href: '/djs', title: 'DJs', blurb: 'The people moving the scene, and what they spin.' },
  { href: '/podcasts', title: 'Podcasts', blurb: 'The conversations around the music.' },
  { href: '/events', title: 'Events', blurb: 'Where to catch drill live.' },
  { href: '/support', title: 'Support', blurb: 'Help keep DrillKe free and independent.' },
];

export default function HomePage() {
  return (
    <main className="container">
      <section style={{ padding: '2rem 0 3rem', maxWidth: 720 }}>
        <p className="badge">Kenyan drill · one track at a time</p>
        <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 3.6rem)', lineHeight: 1.05, margin: '1rem 0' }}>
          Read the bars while the music plays.
        </h1>
        <p className="muted" style={{ fontSize: '1.05rem' }}>
          DrillKe plays Kenyan drill from its original source and lines up the lyrics as it goes —
          with the Sheng, slang and references explained.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
          <Link href="/songs" className="btn btn--primary">
            Start listening
          </Link>
          <Link href="/submit" className="btn">
            Submit lyrics
          </Link>
        </div>
      </section>

      <section aria-labelledby="explore">
        <h2 id="explore" style={{ fontSize: '1.1rem' }}>
          Explore
        </h2>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {SECTIONS.map((section) => (
            <li key={section.href} className="panel">
              <Link href={section.href}>
                <h3 style={{ margin: '0 0 0.35rem' }}>{section.title}</h3>
              </Link>
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                {section.blurb}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: '3rem' }} className="panel">
        <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>New here?</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          DrillKe is not a streaming service. Music stays on YouTube; we add lyrics, context and a
          map of the scene. Read <Link href="/about">about how it works</Link>.
        </p>
      </section>
    </main>
  );
}
