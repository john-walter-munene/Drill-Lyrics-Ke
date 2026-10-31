import Link from 'next/link';
import ResetPasswordForm from './ResetPasswordForm';

/**
 * The page a reset link opens.
 *
 * The token is in the **path**, not a query string: a path is not the thing
 * forwarded in `Referer` headers to the third-party resources this page loads,
 * and it does not land in the page-URL field of any analytics. The metadata is
 * `noindex, nofollow` for the same reason — a reset token must never be picked
 * up by a crawler or shared onward.
 *
 * The form checks the token before showing password fields, so an expired link
 * says so immediately instead of after the user types a new password twice.
 */
export const metadata = {
  title: 'Choose a new password — DrillKe',
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="container container--form">
      <header className="page-head">
        <h1>Choose a new password</h1>
      </header>
      <ResetPasswordForm token={token} />
      <p className="muted">
        Need a new link? <Link href="/forgot-password">Request one</Link>.
      </p>
    </main>
  );
}
