import Link from 'next/link';
import type { Metadata } from 'next';
import { listCompetitions } from '../../api';
import { pageMetadata } from '../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Playlist competitions',
  description:
    'Community playlist competitions — quarterfinal, semifinal and final, with every stage published and every vote counted in the open.',
  path: '/competitions',
});

export const revalidate = 60;

export default async function CompetitionsPage() {
  const data = await listCompetitions();

  return (
    <main className="container">
      <header className="page-head">
        <h1>Playlist competitions</h1>
        <p className="muted">
          Community playlists go head to head over three stages. Every stage is published with its full
          vote count, so the path to the winner can be checked by anyone.
        </p>
      </header>

      {data.items.length === 0 ? (
        <p className="muted">No competitions are running right now.</p>
      ) : (
        <ul className="competition-list">
          {data.items.map((competition) => (
            <li key={competition.slug} className="panel">
              <Link href={`/competitions/${competition.slug}`}>
                <strong>{competition.title}</strong>
              </Link>
              {competition.description ? (
                <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                  {competition.description}
                </p>
              ) : null}
              <p className="competition-list__stages">
                {competition.stages.map((stage) => (
                  <span key={stage.kind} className={`badge competition-list__stage competition-list__stage--${stage.status}`}>
                    {stage.title}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
