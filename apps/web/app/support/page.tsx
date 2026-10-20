import Link from 'next/link';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'Support our work',
  description:
    'DrillKe is free and independent. Here is where the money would go, and every way to help right now — including lending your ear to the catalogue.',
  path: '/support',
});

export const revalidate = 3600;

const WAYS = [
  {
    title: 'Contribute lyrics',
    body: 'The fastest way to help is to time a song you know, or correct one that is wrong.',
    href: '/submit',
    cta: 'Submit lyrics',
  },
  {
    title: 'Report a mistake',
    body: 'Wrong bar, wrong timestamp, wrong annotation — every song page has a report path.',
    href: '/songs',
    cta: 'Find a song',
  },
  {
    title: 'Tell an artist',
    body: 'If you know someone whose songs belong here, send them the link.',
    href: '/about',
    cta: 'How it works',
  },
];

export default function SupportPage() {
  return (
    <main className="container">
      <h1>Support our work</h1>
      <p className="muted" style={{ maxWidth: 680, fontSize: '1.05rem' }}>
        DrillKe is free, independent and open source. There are no ads and we take no commission in
        v1. The platform is funded by the people who want it to exist.
      </p>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>Where the money goes</h2>
        <div className="panel" style={{ maxWidth: 680 }}>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.9 }} className="muted">
            <li>Hosting and a managed database — the largest recurring cost.</li>
            <li>Review time, so contributions get published quickly.</li>
            <li>Transcription and timestamping for songs the community cannot cover alone.</li>
          </ul>
        </div>
        <p className="muted" style={{ fontSize: '0.85rem', maxWidth: 680 }}>
          Funding rails are not live yet. Until they are, contributions of time are worth more
          than money.
        </p>
      </section>

      <section style={{ marginTop: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>Ways to help now</h2>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          {WAYS.map((way) => (
            <li key={way.title} className="panel">
              <h3 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>{way.title}</h3>
              <p className="muted" style={{ margin: '0 0 0.9rem', fontSize: '0.9rem' }}>
                {way.body}
              </p>
              <Link href={way.href} className="btn btn--sm">
                {way.cta}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: '2.5rem', maxWidth: 680 }}>
        <h2 style={{ fontSize: '1.1rem' }}>Is DrillKe a business?</h2>
        <p className="muted">
          Eventually, yes — artist storefronts and merch are on the roadmap, with a transparent
          commission. But the first version makes no money at all. It exists to prove that a
          better way to experience Kenyan drill is worth having.
        </p>
      </section>
    </main>
  );
}
