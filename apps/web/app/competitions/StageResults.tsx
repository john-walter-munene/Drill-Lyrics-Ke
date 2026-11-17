import type { StageTally } from '@drillke/shared';
import { STAGE_LABELS } from '@drillke/shared';

/**
 * One stage's published result.
 *
 * Transparency is the point of this component: every entrant is listed with its
 * vote count, its share of the stage, and whether it advanced — including the
 * entrants that were eliminated. A closed stage keeps showing its numbers while
 * a later stage is being voted on, so the whole path to the winner can be
 * checked by anyone.
 */
export default function StageResults({
  tally,
  isCurrent,
  competitionWinnerId,
}: {
  tally: StageTally;
  isCurrent: boolean;
  /** The competition's overall winner. Only the final may label a row "Winner". */
  competitionWinnerId: string | null;
}) {
  const decided = tally.status === 'voting_closed' || tally.status === 'completed';
  const maxVotes = Math.max(1, ...tally.standings.map((standing) => standing.votes));

  return (
    <section
      className={`stage-results${isCurrent ? ' stage-results--current' : ''}`}
      aria-labelledby={`stage-${tally.stageId}`}
    >
      <header className="stage-results__head">
        <div>
          <p className="stage-results__eyebrow">
            Stage {tally.order} · {STAGE_LABELS[tally.kind]}
          </p>
          <h2 id={`stage-${tally.stageId}`}>{tally.title}</h2>
        </div>

        <div className="stage-results__meta">
          <span className={`badge stage-results__status stage-results__status--${tally.status}`}>
            {statusLabel(tally.status)}
          </span>
          <span className="muted">
            {tally.totalVotes} {tally.totalVotes === 1 ? 'vote' : 'votes'}
            {tally.advancing > 0 ? ` · top ${tally.advancing} advance` : ' · decides the winner'}
          </span>
        </div>
      </header>

      {tally.standings.length === 0 ? (
        <p className="muted">No entrants in this stage yet.</p>
      ) : (
        <ol className="stage-results__list">
          {tally.standings.map((standing) => {
            const share = tally.totalVotes > 0 ? (standing.votes / tally.totalVotes) * 100 : 0;
            // "Winner" is reserved for the competition winner. A stage winner
            // that did not go on to take the title is shown as having advanced,
            // otherwise the semifinal appears to crown a second champion.
            const isWinner = tally.kind === 'final' && competitionWinnerId === standing.entryId;

            return (
              <li
                key={standing.entryId}
                className={[
                  'stage-results__row',
                  standing.advancing ? 'stage-results__row--advancing' : '',
                  isWinner ? 'stage-results__row--winner' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="stage-results__rank" aria-label={`Rank ${standing.rank}`}>
                  {standing.rank}
                </span>

                <div className="stage-results__entry">
                  <strong>{standing.title}</strong>
                  <small className="muted">{standing.curator}</small>
                </div>

                <div className="stage-results__bar" aria-hidden="true">
                  <span style={{ width: `${(standing.votes / maxVotes) * 100}%` }} />
                </div>

                <div className="stage-results__count">
                  <strong>{standing.votes}</strong>
                  <small className="muted">{share.toFixed(1)}%</small>
                </div>

                <span className="stage-results__flag">
                  {isWinner ? (
                    <span className="badge badge--accent">Winner</span>
                  ) : standing.advancing ? (
                    <span className="badge">Advanced</span>
                  ) : decided ? (
                    <span className="muted stage-results__out">Out</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {tally.tiedAtCutoff ? (
        <p className="stage-results__notice" role="status">
          <strong>Tie across the cut line.</strong> {tally.standings[tally.advancing - 1]?.votes} votes
          each — the organiser must decide who advances before the next stage can open.
        </p>
      ) : null}

      {tally.tiebreakEntryId ? (
        <p className="stage-results__notice stage-results__notice--resolved">
          <strong>Tie resolved by the organiser.</strong>{' '}
          {tally.standings.find((standing) => standing.entryId === tally.tiebreakEntryId)?.title} advanced.
        </p>
      ) : null}

      {tally.tiebreakRequired && decided ? (
        <p className="stage-results__notice">
          <strong>Top two tied.</strong> No winner can be declared until the organiser resolves it.
        </p>
      ) : null}
    </section>
  );
}

function statusLabel(status: StageTally['status']): string {
  switch (status) {
    case 'pending':
      return 'Not started';
    case 'voting_open':
      return 'Voting open';
    case 'voting_closed':
      return 'Voting closed';
    case 'completed':
      return 'Complete';
  }
}
