
import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '../../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy',
  description:
    'Learn what information Drill Lyrics KE collects, how it is used, and how you can access or delete your account data.',
  path: '/legal/privacy',
});

export default function PrivacyPage() {
  return (
    <main className="container">
      <header className="page-head">
        <h1>Privacy</h1>
        <p className="badge">Draft — pending legal review</p>
        <p className="muted">
          Your privacy matters to us. This page explains what information
          Drill Lyrics KE stores, how it is used, and the controls available
          to you when you use the platform.
        </p>
      </header>

      <h2>1. Information we store</h2>

      <p className="muted">
        When you create an account, we store information needed to operate
        and secure it, including:
      </p>

      <ul className="muted" style={{ lineHeight: 1.8 }}>
        <li>Email address and display name.</li>
        <li>A password hash, never your plain-text password.</li>
        <li>Your account role and email confirmation status.</li>
        <li>Relevant account and sign-in timestamps.</li>
      </ul>

      <p className="muted">
        We also store information submitted through the platform, such as
        lyrics, corrections, annotations, and artist suggestions.
        Submissions are anonymous unless you are signed in. Signed-in
        submissions are associated with your account for review and
        moderation purposes.
      </p>

      <p className="muted">
        Public contributor recognition is optional and disabled by
        default. Your participation does not automatically mean your
        name will appear publicly.
      </p>

      <h2>2. How we protect your information</h2>

      <p className="muted">
        We use security measures intended to protect account information
        and prevent unauthorized access.
      </p>

      <ul className="muted" style={{ lineHeight: 1.8 }}>
        <li>
          Passwords are stored as salted scrypt hashes rather than
          readable passwords.
        </li>
        <li>
          Password-reset and email-confirmation tokens are stored as
          hashes rather than reusable plain-text tokens.
        </li>
        <li>
          Account sessions are managed to support authentication and
          account security.
        </li>
      </ul>

      <h2>3. What we do not do</h2>

      <ul className="muted" style={{ lineHeight: 1.8 }}>
        <li>We do not sell personal information to advertisers.</li>
        <li>We do not use cross-site tracking.</li>
        <li>
          We do not use third-party analytics on pages containing
          account information.
        </li>
      </ul>

      <h2>4. Third-party services</h2>

      <p className="muted">
        Drill Lyrics KE uses third-party services to provide parts of
        the experience. Music and video playback may use YouTube embeds,
        including privacy-enhanced embeds where supported.
      </p>

      <p className="muted">
        When you interact with embedded content, the relevant third-party
        provider may process information according to its own privacy
        policies and terms. We do not control how those external services
        handle information.
      </p>

      <h2>5. Accessing your information</h2>

      <p className="muted">
        You can access the account-data tools directly from{' '}
        <Link href="/account">your account page</Link>.
      </p>

      <ul className="muted" style={{ lineHeight: 1.8 }}>
        <li>
          <strong>Download your data.</strong> Use the{' '}
          <em>Download your data</em> option to obtain a JSON export
          containing your account details, submissions, and sessions.
          The export does not include passwords or security tokens.
        </li>
        <li>
          <strong>Delete your account.</strong> Use the account deletion
          option to request deletion. The process is confirmed by email.
          Submissions awaiting review are withdrawn.
        </li>
      </ul>

      <p className="muted">
        Lyrics already published may remain in the public catalogue after
        account deletion. If you want your contributor name removed from
        published material, contact us with the relevant details.
      </p>

      <h2>6. Data retention</h2>

      <p className="muted">
        We retain account and contribution information for as long as
        necessary to operate the platform, maintain the music catalogue,
        support moderation, and meet applicable obligations. Retention
        may differ depending on the type of information and whether it
        forms part of published catalogue content.
      </p>

      <h2>7. Your privacy choices</h2>

      <p className="muted">
        You can manage your account information, download your data, or
        request account deletion through{' '}
        <Link href="/account">your account</Link>. For content-related
        concerns, including removal requests, see our{' '}
        <Link href="/legal/rights">Rights &amp; takedowns</Link> page.
      </p>

      <h2>8. Changes to this policy</h2>

      <p className="muted">
        As Drill Lyrics KE develops, our data practices may change.
        Updates to this page will explain any relevant changes to how
        information is collected, used, or retained.
      </p>

      <p className="muted">
        This policy is a working draft pending legal review. It should
        be read alongside our <Link href="/legal/terms">Terms of use</Link>.
      </p>
    </main>
  );
}