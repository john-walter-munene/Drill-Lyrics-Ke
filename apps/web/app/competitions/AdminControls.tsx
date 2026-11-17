'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StageTally } from '@drillke/shared';
import {
  addCommitteeMember,
  closeCompetitionStage,
  openCompetitionStage,
  removeCommitteeMember,
  resolveCompetitionTie,
} from '../../api';

/**
 * The organiser's controls for one competition.
 *
 * Everything here is admin-only on the API as well — this component is the
 * convenience, not the security boundary. Each action reports its own error
 * inline, because "the quarterfinal is tied" is a message the organiser needs
 * to read, not a generic failure.
 */
export default function AdminControls({
  slug,
  stages,
  committee,
}: {
  slug: string;
  stages: StageTally[];
  committee: {
    active: { userId: string; displayName: string; role: string; addedAt: string }[];
    removed: {
      userId: string;
      displayName: string;
      email: string;
      role: string;
      addedAt: string;
      removedAt: string | null;
      removalReason: string | null;
    }[];
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [removeReason, setRemoveReason] = useState('');
  const [tieEntry, setTieEntry] = useState('');
  const [tieReason, setTieReason] = useState('');

  async function run(key: string, action: () => Promise<{ ok: boolean; message?: string | string[] }>, success: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    const result = await action();
    setBusy(null);
    if (!result.ok) {
      setError(Array.isArray(result.message) ? result.message.join(' ') : result.message ?? 'That did not work.');
      return;
    }
    setNotice(success);
    router.refresh();
  }

  const tiedStage = stages.find((stage) => stage.tiedAtCutoff);

  return (
    <section className="panel admin-controls" aria-labelledby="admin-controls-heading">
      <h2 id="admin-controls-heading">Organiser controls</h2>
      <p className="muted">
        Open and close each stage, appoint the committee, and resolve a tie. Every action is recorded in the audit log.
      </p>

      {error ? <p className="admin-controls__error" role="alert">{error}</p> : null}
      {notice ? <p className="admin-controls__notice" role="status">{notice}</p> : null}

      <h3>Stages</h3>
      <ul className="admin-controls__stages">
        {stages.map((stage) => (
          <li key={stage.stageId}>
            <div>
              <strong>{stage.title}</strong>
              <small className="muted">
                {' '}· {stage.status.replace('_', ' ')} · {stage.totalVotes} votes
              </small>
            </div>
            <div className="admin-controls__actions">
              {stage.status === 'pending' || stage.status === 'voting_closed' ? (
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={busy !== null}
                  onClick={() => run(`open-${stage.stageId}`, () => openCompetitionStage(slug, stage.stageId), `${stage.title} is open for voting.`)}
                >
                  {busy === `open-${stage.stageId}` ? 'Opening…' : 'Open voting'}
                </button>
              ) : null}
              {stage.status === 'voting_open' ? (
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  disabled={busy !== null}
                  onClick={() => run(`close-${stage.stageId}`, () => closeCompetitionStage(slug, stage.stageId), `${stage.title} closed.`)}
                >
                  {busy === `close-${stage.stageId}` ? 'Closing…' : 'Close voting'}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {tiedStage ? (
        <div className="admin-controls__tiebreak">
          <h3>Resolve the tie in the {tiedStage.title.toLowerCase()}</h3>
          <p className="muted">
            {tiedStage.standings[tiedStage.advancing - 1]?.votes} votes each across the cut line. Choose who advances.
          </p>
          <label>
            Entrant
            <select value={tieEntry} onChange={(event) => setTieEntry(event.target.value)}>
              <option value="">Choose an entrant…</option>
              {tiedStage.standings
                .filter((standing) => standing.rank === tiedStage.advancing)
                .map((standing) => (
                  <option key={standing.entryId} value={standing.entryId}>
                    {standing.title} — {standing.curator}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Reason (recorded in the audit log)
            <input
              value={tieReason}
              onChange={(event) => setTieReason(event.target.value)}
              placeholder="e.g. Higher share of first-time voters"
            />
          </label>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={!tieEntry || tieReason.trim().length < 3 || busy !== null}
            onClick={() =>
              run(
                'tiebreak',
                () => resolveCompetitionTie(slug, tiedStage.stageId, tieEntry, tieReason),
                'Tie resolved.',
              )
            }
          >
            {busy === 'tiebreak' ? 'Saving…' : 'Resolve tie'}
          </button>
        </div>
      ) : null}

      <h3>Committee</h3>
      <p className="muted">
        Committee members can vote in committee-only competitions. Removing someone keeps their past votes on the record.
      </p>

      <ul className="admin-controls__committee">
        {committee.active.map((member) => (
          <li key={member.userId}>
            <div>
              <strong>{member.displayName}</strong>
              <small className="muted"> · {member.role}</small>
            </div>
            <div className="admin-controls__actions">
              <input
                aria-label={`Reason for removing ${member.displayName}`}
                placeholder="Reason (optional)"
                value={removeReason}
                onChange={(event) => setRemoveReason(event.target.value)}
              />
              <button
                type="button"
                className="btn btn--sm"
                disabled={busy !== null}
                onClick={() =>
                  run(
                    `remove-${member.userId}`,
                    () => removeCommitteeMember(slug, member.userId, removeReason),
                    `${member.displayName} removed from the committee.`,
                  )
                }
              >
                {busy === `remove-${member.userId}` ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </li>
        ))}
        {committee.active.length === 0 ? <li className="muted">No committee members yet.</li> : null}
      </ul>

      <div className="admin-controls__add">
        <label>
          Account email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="judge@example.com"
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="member">Member</option>
            <option value="chair">Chair</option>
          </select>
        </label>
        <button
          type="button"
          className="btn btn--sm btn--primary"
          disabled={!email.includes('@') || busy !== null}
          onClick={() =>
            run('add-member', () => addCommitteeMember(slug, email, role), 'Committee member added.').then(() => setEmail(''))
          }
        >
          {busy === 'add-member' ? 'Adding…' : 'Add member'}
        </button>
      </div>

      {committee.removed.length > 0 ? (
        <details className="admin-controls__removed">
          <summary>Removed members ({committee.removed.length})</summary>
          <ul>
            {committee.removed.map((member) => (
              <li key={member.userId}>
                <strong>{member.displayName}</strong>
                <span className="muted">
                  {' '}· removed {member.removedAt ? new Date(member.removedAt).toLocaleDateString() : ''}
                  {member.removalReason ? ` — ${member.removalReason}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
