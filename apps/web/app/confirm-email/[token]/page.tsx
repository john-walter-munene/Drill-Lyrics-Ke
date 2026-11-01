import Link from 'next/link';
import ConfirmEmail from './ConfirmEmail';

/**
 * The page a sign-up confirmation link opens.
 *
 * Same reasoning as `/reset-password/[token]`: the token is in the path and the
 * page is `noindex, nofollow`, so a crawler never spends someone's link and a
 * `Referer` never carries it to a third party.
 */
export const metadata = {
  title: 'Confirm your email — DrillKe',
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = 'force-dynamic';

export default async function ConfirmEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="container container--form">
      <header className="page-head">
        <h1>Confirming your email</h1>
      </header>
      <ConfirmEmail token={token} />
      <p className="muted">
        <Link href="/account">Go to your account</Link> · <Link href="/songs">Browse songs</Link>
      </p>
    </main>
  );
}
