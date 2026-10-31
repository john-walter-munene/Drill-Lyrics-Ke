import type { Metadata } from 'next';
import { getTopContributors, listSongs } from '../../api';
import { pageMetadata } from '../../lib/seo';
import LyricsSubmissionForm from './LyricsSubmissionForm';

// Catalogue data must be fetched by the running web server from the API
// container, not captured as an empty build-time page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Submit lyrics',
  description: 'Submit lyrics and timestamps for a song in the Drill Lyrics catalogue.',
  path: '/submit',
});

export default async function SubmitPage() {
  const [catalogue, contributors] = await Promise.all([listSongs({ page: 1 }), getTopContributors()]);

  return (
    <main className="container container--reading">
      <header className="page-head">
        <h1>Submit lyrics</h1>
        <p className="muted">
          Choose a song from the catalogue and paste its lyrics. You can add timestamps now or submit
          plain lines and sync them later. Submissions stay pending until reviewed.
        </p>
      </header>

      <section className="panel">
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Before you submit</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.9 }}>
          <li>Only submit lyrics you have the right to share.</li>
          <li>Use one lyric line per row.</li>
          <li>For synced lines, put a timestamp first, like <code>[00:12.500] First line</code>.</li>
          <li>Every submission is saved for review; it will not appear as published lyrics immediately.</li>
        </ul>
      </section>

      <LyricsSubmissionForm songs={catalogue.items} />
      {contributors.items.length > 0 && <section className="panel" style={{ marginTop: '2rem' }}><h2>Community contributors</h2><p className="muted">Published lyric contributions credited by their authors. Recognition only; there is no payment promise.</p><ol>{contributors.items.map((person) => <li key={person.name}>{person.name} — {person.publishedContributions} published {person.publishedContributions === 1 ? 'contribution' : 'contributions'}</li>)}</ol></section>}
    </main>
  );
}
