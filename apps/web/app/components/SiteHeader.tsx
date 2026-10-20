import Link from 'next/link';

const LINKS = [
  { href: '/songs', label: 'Songs' },
  { href: '/artists', label: 'Artists' },
  { href: '/djs', label: 'DJs' },
  { href: '/podcasts', label: 'Podcasts' },
  { href: '/events', label: 'Events' },
  { href: '/about', label: 'About' },
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-header__brand">
        DrillKe 🇰🇪
      </Link>
      <nav className="site-header__nav" aria-label="Primary">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
        <Link href="/support">Support</Link>
        <Link href="/submit" className="btn btn--primary btn--sm">
          Submit lyrics
        </Link>
      </nav>
    </header>
  );
}
