
import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '../../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Terms of use',
  description:
    'Read the terms governing access to and use of Drill Lyrics KE, including community contributions, content, and third-party services.',
  path: '/legal/terms',
});

export default function TermsPage() {
  return (
    <main className="container">
      <header className="page-head">
        <h1>Terms of use</h1>
        <p className="badge">Draft — pending legal review</p>
        <p className="muted">
          Welcome to Drill Lyrics KE. These terms explain the basic rules
          for accessing and using our platform. By using the platform, you
          agree to follow these terms and applicable laws.
        </p>
      </header>

      <h2>1. About the platform</h2>
      <p className="muted">
        Drill Lyrics KE is an open-source music discovery and lyrics
        platform focused on Kenyan drill. It helps users discover songs
        and artists, explore lyrics, and contribute to documenting the
        music and culture surrounding the scene.
      </p>

      <h2>2. Music and third-party content</h2>
      <p className="muted">
        Music and video playback may be provided through embedded
        third-party services such as YouTube. We do not download or
        rehost those recordings. Their availability and use remain
        subject to the relevant platform&apos;s terms and policies.
      </p>
      <p className="muted">
        Artist names, recordings, artwork, lyrics, and other creative
        works remain the property of their respective owners. Being
        listed on Drill Lyrics KE does not imply that an artist endorses
        or is affiliated with the project.
      </p>

      <h2>3. Community contributions</h2>
      <p className="muted">
        Users may be able to submit lyrics, corrections, annotations,
        artist suggestions, and other music-related information.
        Submissions are subject to review and may be edited, rejected,
        unpublished, or removed.
      </p>
      <p className="muted">
        Only submit material you have the right or permission to share.
        Do not submit private, misleading, unlawful, or infringing
        material. Public contributor recognition is optional and does
        not create an entitlement to payment or other compensation.
      </p>

      <h2>4. Acceptable use</h2>
      <p className="muted">
        You agree not to use the platform to harass, threaten, impersonate,
        expose private information, publish hate speech, distribute
        malicious content, or interfere with the platform&apos;s operation.
        Do not attempt unauthorized access to accounts, systems, or data.
      </p>

      <h2>5. Accounts and submissions</h2>
      <p className="muted">
        If you create an account, you are responsible for keeping your
        sign-in details secure and for activity carried out through your
        account. We may restrict access or take moderation action where
        these terms are violated or where necessary to protect the
        platform and its community.
      </p>

      <h2>6. Open-source software</h2>
      <p className="muted">
        Drill Lyrics KE&apos;s software is developed openly. The
        software&apos;s open-source licence does not grant permission to
        copy, distribute, or use third-party lyrics, recordings, artwork,
        or other protected content.
      </p>

      <h2>7. Content availability and changes</h2>
      <p className="muted">
        We aim to keep the platform useful and accurate, but we do not
        guarantee uninterrupted availability, error-free information, or
        the continued availability of third-party content. Features,
        content, and these terms may change as the project develops.
      </p>

      <h2>8. Rights and content concerns</h2>
      <p className="muted">
        If you are an artist, rights holder, or representative with a
        concern about material on the platform, please use our{' '}
        <Link href="/legal/rights">rights and takedown information</Link>{' '}
        to contact us.
      </p>

      <h2>9. Contact and updates</h2>
      <p className="muted">
        We may update these terms as the platform evolves. Continued use
        after updated terms are published means you accept the revised
        terms, subject to applicable law.
      </p>

      <p className="muted">
        For questions about these terms, visit our{' '}
        <Link href="/support">support page</Link>.
      </p>

      <p className="muted">
        These terms are a working draft and should not be treated as
        legal advice or a substitute for a review by a qualified lawyer.
      </p>
    </main>
  );
}