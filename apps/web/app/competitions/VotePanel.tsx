'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StageTally } from '@drillke/shared';
import { castVote } from '../../api';
import { getDeviceToken } from '../../lib/device';

/**
 * The ballot for the open stage.
 *
 * One pick per voter per stage. The device token is attached so the live rule
 * (one device per account) can be enforced; a browser that cannot store one
 * still votes, and the API simply does not apply the rule.
 */
export default function VotePanel({
  slug,
  stage,
  myVote,
  canVote,
  allowVoteChange,
}: {
  slug: string;
  stage: StageTally;
  myVote: { stageId: string; entryId: string } | null;
  canVote: boolean;
  allowVoteChange: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(myVote?.entryId ?? null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const hasVoted = Boolean(myVote);
  const locked = hasVoted && !allowVoteChange;

  async function submit() {
    if (!selected || pending) return;
    setPending(true);
    setMessage(null);

    const result = await castVote(slug, selected, getDeviceToken());
    setPending(false);

    if (!result.ok) {
      setMessage({ tone: 'error', text: Array.isArray(result.message) ? result.message.join(' ') : result.message });
      return;
    }

    setMessage({
      tone: 'ok',
      text: result.data.changed ? 'Your vote has been changed.' : 'Your vote is in. Thank you.',
    });
    router.refresh();
  }

  if (!canVote) {
    return (
      <section className="panel vote-panel">
        <h2>Voting is open</h2>
        <p className="muted">
          This competition is limited to appointed committee members. Sign in with a committee account to vote.
        </p>
      </section>
    );
  }

  return (
    <section className="panel vote-panel" aria-labelledby="vote-heading">
      <h2 id="vote-heading">Vote in the {stage.title.toLowerCase()}</h2>
      <p className="muted">
        One vote per person. {allowVoteChange ? 'You can change your pick until the stage closes.' : 'Your pick is final once cast.'}
      </p>

      <fieldset className="vote-panel__options" disabled={locked || pending}>
        <legend className="visually-hidden">Choose one playlist</legend>
        {stage.standings.map((standing) => (
          <label
            key={standing.entryId}
            className={`vote-panel__option${selected === standing.entryId ? ' is-selected' : ''}`}
          >
            <input
              type="radio"
              name="entry"
              value={standing.entryId}
              checked={selected === standing.entryId}
              onChange={() => setSelected(standing.entryId)}
            />
            <span className="vote-panel__option-copy">
              <strong>{standing.title}</strong>
              <small className="muted">{standing.curator}</small>
            </span>
            {myVote?.entryId === standing.entryId ? <span className="badge badge--accent">Your vote</span> : null}
          </label>
        ))}
      </fieldset>

      {locked ? (
        <p className="vote-panel__message" role="status">
          You have already voted in this stage.
        </p>
      ) : (
        <button
          type="button"
          className="btn btn--primary"
          onClick={submit}
          disabled={!selected || pending}
        >
          {pending ? 'Sending…' : hasVoted ? 'Change my vote' : 'Cast my vote'}
        </button>
      )}

      {message ? (
        <p
          className={`vote-panel__message vote-panel__message--${message.tone}`}
          role={message.tone === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
