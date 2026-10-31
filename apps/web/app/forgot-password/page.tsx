import Link from 'next/link';
import ForgotPasswordForm from './ForgotPasswordForm';

export const metadata = { title: 'Reset your password — DrillKe', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <main className="container container--form">
      <header className="page-head">
        <h1>Reset your password</h1>
        <p className="muted">
          Enter the email you signed up with and we will send a link to choose a new password.
        </p>
      </header>
      <ForgotPasswordForm />
      <p className="muted">
        Remembered it? <Link href="/sign-in">Sign in</Link>.
      </p>
    </main>
  );
}
