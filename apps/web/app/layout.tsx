import './globals.css';
import Link from 'next/link';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import PlayerProvider from './components/player/PlayerProvider';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'DrillKe — Kenyan drill lyrics',
    template: '%s · DrillKe',
  },
  description:
    'The home of Kenyan drill. Read the bars while the music plays — synchronized lyrics, Sheng annotations, artists, DJs, podcasts and events.',
  icons: {
    icon: '/favicon.svg',
    apple: '/icon-192.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'DrillKe',
    title: 'DrillKe — Kenyan drill lyrics',
    description: 'Read the bars while the music plays.',
    images: [{ url: '/og-default.svg', width: 1200, height: 630, alt: 'DrillKe' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DrillKe — Kenyan drill lyrics',
    description: 'Read the bars while the music plays.',
    images: ['/og-default.svg'],
  },
};

export const viewport = {
  themeColor: '#0c0b0a',
};

// Applied before paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('drillke-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <SiteHeader />
        {/* The player lives above the routes so navigation never unmounts it. */}
        <PlayerProvider>
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </PlayerProvider>
        <SiteFooter />
        <noscript>
          <p className="container muted">
            <Link href="/songs">Browse songs</Link> — lyrics work without
            JavaScript, but playback syncing needs it.
          </p>
        </noscript>
      </body>
    </html>
  );
}
