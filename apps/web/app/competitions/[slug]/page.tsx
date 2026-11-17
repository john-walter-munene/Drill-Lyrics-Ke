import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCompetition } from '../../../api';
import { pageMetadata } from '../../../lib/seo';
import StageResults from '../StageResults';
import VotePanel from '../VotePanel';
import AdminControls from '../AdminControls';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition) return { title: 'Competition not found' };
  return pageMetadata({
    title: competition.title,
    description:
      competition.description ??
      `${competition.title} — three stages, published results, one winner.`,
    path: `/competitions/${competition.slug}`,
  });
}

export default async function CompetitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition) notFound();

  const winner = competition.entries.find((entry) => entry.id === competition.winnerEntryId);

  return (
    <main className="container competition-page">
      <nav aria-label="Breadcrumb" className="muted" style={{ fontSize: '0.85rem' }}>
        <Link href="/competitions">Competitions</Link> / <span>{competition.title}</span>
      </nav>

      <header className="competition-page__hero">
        <p className="badge">{competition.organizer ?? 'Drill Lyrics KE'}</p>
        <h1>{competition.title}</h1>
        {competition.description ? <p className="competition-page__lead">{competition.description}</p> : null}
      </header>

      {winner ? (
        <section className="competition-winner" aria-labelledby="winner-heading">
          <p className="competition-winner__label">Winner</p>
          <h2 id="winner-heading">{winner.title}</h2>
          <p className="muted">Curated by {winner.curator}</p>
        </section>
      ) : null}

      {competition.currentStage ? (
        <VotePanel
          slug={competition.slug}
          stage={competition.currentStage}
          myVote={competition.viewer.myVote}
          canVote={competition.viewer.canVote}
          allowVoteChange={competition.allowVoteChange}
        />
      ) : null}

      <section className="competition-page__stages" aria-labelledby="stages-heading">
        <h2 id="stages-heading">The bracket</h2>
        <p className="muted">
          Each stage is published as soon as it closes. Vote counts include every valid vote; invalidated
          votes are excluded and kept on the record.
        </p>

        {competition.stages.map((stage) => (
          <StageResults
            key={stage.stageId}
            tally={stage}
            isCurrent={competition.currentStage?.stageId === stage.stageId}
            competitionWinnerId={competition.winnerEntryId}
          />
        ))}
      </section>

      <section className="competition-page__committee" aria-labelledby="committee-heading">
        <h2 id="committee-heading">Committee</h2>
        <p className="muted">
          The committee oversees the competition. Members are appointed by the organiser and can be removed;
          a removed member&apos;s past votes stay on the record.
        </p>
        <ul className="competition-page__committee-list">
          {competition.committee.active.map((member) => (
            <li key={member.userId}>
              <strong>{member.displayName}</strong>
              <span className="badge">{member.role}</span>
            </li>
          ))}
          {competition.committee.active.length === 0 ? <li className="muted">No committee appointed yet.</li> : null}
        </ul>
      </section>

      {competition.viewer.isAdmin ? (
        <AdminControls slug={competition.slug} stages={competition.stages} committee={competition.committee} />
      ) : null}
    </main>
  );
}
