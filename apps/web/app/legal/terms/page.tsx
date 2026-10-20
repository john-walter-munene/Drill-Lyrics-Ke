import type { Metadata } from 'next';
import { pageMetadata } from '../../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Terms of use',
  description: 'The terms that apply to using DrillKe. Draft pending legal review.',
  path: '/legal/terms',
});

export default function TermsPage() {
  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <h1>Terms of use</h1>
      <p className="badge">Draft — pending legal review</p>
      <p className="muted">
        DrillKe references and embeds music hosted on other platforms. We do not sell music, take
        bets, or offer ticketing. Contributions are reviewed and may be edited or removed.
      </p>
      <h2>Content</h2>
      <p className="muted">
        Lyrics, artwork and artist names belong to their respective owners. Contributing does not
        transfer ownership; it grants DrillKe permission to display your submission.
      </p>
      <h2>Conduct</h2>
      <p className="muted">
        No harassment, hate speech, doxxing or threats. Content moderation follows the rules in
        the project documentation.
      </p>
    </main>
  );
}
