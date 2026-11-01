'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSessionUser, signOut } from '../../api';

type User = { id: string; email: string; displayName: string; role: string };
export default function AuthLinks() {
  const [user, setUser] = useState<User | null>(null);
  // `getSessionUser` also tries the stored bearer token, so the header agrees
  // with the admin dashboard when cookies are blocked for the API origin.
  useEffect(() => { void getSessionUser().then((result) => setUser(result.ok ? result.user : null)); }, []);
  if (!user) return <Link href="/sign-in" className="site-header__auth-link">Sign in</Link>;
  return <span className="site-header__auth-link">
    <Link href={user.role === 'admin' || user.role === 'moderator' ? '/admin' : '/account'}>{user.displayName}</Link>
    <button type="button" onClick={async () => { await signOut(); setUser(null); }}>Sign out</button>
  </span>;
}
