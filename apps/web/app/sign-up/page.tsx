import Link from 'next/link';
import AuthForm from '../components/AuthForm';

export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  return (
    <main className="container container--form">
      <header className="page-head">
        <h1>Create an account</h1>
        <p className="muted">
          Listening and lyric submissions stay open to everyone. An account adds submission history and
          optional contributor recognition.
        </p>
      </header>
      <AuthForm mode="signup" />
      <p className="muted">
        Already registered? <Link href="/sign-in">Sign in</Link>.
      </p>
    </main>
  );
}
