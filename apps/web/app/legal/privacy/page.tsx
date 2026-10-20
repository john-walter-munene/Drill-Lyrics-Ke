import type { Metadata } from 'next';
import { pageMetadata } from '../../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy',
  description: 'What DrillKe collects, what it does not, and how to remove your data.',
  path: '/legal/privacy',
});

export default function PrivacyPage() {
  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <h1>Privacy</h1>
      <p className="badge">Draft — pending legal review</p>
      <p className="muted">
        We collect the minimum needed to run the platform: an email and display name when you
        create an account, and anonymous page/player events. No cross-site tracking, no selling data.
      </p>
      <h2>Third parties</h2>
      <p className="muted">
        Playback is embedded from YouTube and is subject to YouTube&apos;s own privacy practices. We
        use the privacy-enhanced embed where possible.
      </p>
      <h2>Your rights</h2>
      <p className="muted">
        You can request export or deletion of your account data at any time.
      </p>
    </main>
  );
}
