import Link from 'next/link';
import AuthForm from '../components/AuthForm';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <main className="container container--form">
      <header className="page-head">
        <h1>Sign in</h1>
        <p className="muted">Sign in to follow your lyrics submissions and receive contributor credit.</p>
      </header>
      <AuthForm mode="signin" />
      <p className="muted">
        New here? <Link href="/sign-up">Create an account</Link>. <Link href="/forgot-password">Forgot your password?</Link>
      </p>
    </main>
  );
}
