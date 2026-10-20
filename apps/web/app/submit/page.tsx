import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata } from '../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Submit lyrics',
  description: 'Help build the DrillKe catalogue — submit lyrics, timestamps or corrections for a Kenyan drill song.',
  path: '/submit',
});

export default function SubmitPage() {
  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <h1>Submit lyrics</h1>
      <p className="muted">
        Every song on DrillKe starts with someone who knows the bars. Submit lyrics, add timestamps,
        or correct a line. Nothing publishes without review.
      </p>

      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Before you start</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.9 }}>
          <li>Only submit lyrics you have the right to share.</li>
          <li>Be accurate — listen twice, prefer the artist&apos;s own published lines.</li>
          <li>Timestamps follow the format in the lyrics guide: <code>[00:12.500]</code>.</li>
          <li>Keep annotations factual and respectful.</li>
        </ul>
      </section>

      <form style={{ marginTop: '1.5rem', display: 'grid', gap: '0.75rem' }} aria-describedby="submit-note">
        <label htmlFor="song" style={{ fontWeight: 600 }}>
          Song
        </label>
        <input
          id="song"
          name="song"
          placeholder="Artist — Title (or a DrillKe song link)"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--fg)',
            borderRadius: 8,
            padding: '0.6rem 0.7rem',
          }}
        />

        <label htmlFor="markdown" style={{ fontWeight: 600 }}>
          Lyrics (Markdown)
        </label>
        <textarea
          id="markdown"
          name="markdown"
          rows={14}
          placeholder={'---\ntitle: "…"\nartist: "…"\nyoutubeVideoId: "…"\n---\n\n[00:12.500] First line…'}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--fg)',
            borderRadius: 8,
            padding: '0.7rem',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '0.85rem',
            resize: 'vertical',
          }}
        />

        <button type="submit" className="btn btn--primary" disabled>
          Submit for review
        </button>
        <p id="submit-note" className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
          Submission is disabled in this scaffold. It connects to{' '}
          <code>POST /api/lyrics/submissions</code> in Phase 1 — see{' '}
          <Link href="/about">how review works</Link>.
        </p>
      </form>
    </main>
  );
}
