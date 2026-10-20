import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container" style={{ padding: 0 }}>
        <nav aria-label="Footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <Link href="/about">About</Link>
          <Link href="/support">Support our work</Link>
          <Link href="/submit">Contribute lyrics</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/rights">Rights &amp; takedowns</Link>
        </nav>
        <p style={{ marginTop: '1rem' }}>
          DrillKe references and embeds music from its original source. Lyrics remain the property
          of their writers and rights holders.
        </p>
        <p>
          <b>DrillKe</b> · Built by the community, for the culture. 🇰🇪 · One track at a time.
        </p>
      </div>
    </footer>
  );
}
