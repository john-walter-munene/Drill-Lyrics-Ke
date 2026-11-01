
import Link from 'next/link';
import KenyanFlag from './KenyanFlag';

const FOOTER_SECTIONS = [
  {
    title: 'Explore music',
    label: 'Explore music',
    links: [
      { href: '/songs', label: 'Songs & lyrics' },
      { href: '/artists', label: 'Artists' },
      { href: '/submit', label: 'Submit lyrics' },
    ],
  },
  {
    title: 'The scene',
    label: 'Explore the Kenyan drill scene',
    links: [
      { href: '/djs', label: 'DJs & mixes' },
      { href: '/podcasts', label: 'Podcasts' },
      { href: '/events', label: 'Events' },
    ],
  },
  {
    title: 'Creators & community',
    label: 'Creators and community',
    links: [
      { href: '/about', label: 'Our story' },
      { href: '/developers', label: 'Build with us' },
      { href: '/support', label: 'Support the project' },
      { href: '/submit', label: 'Contribute to the catalogue' },
    ],
  },
  {
    title: 'Policies & rights',
    label: 'Policies and rights',
    links: [
      { href: '/legal/rights', label: 'Rights & takedowns' },
      { href: '/legal/privacy', label: 'Privacy policy' },
      { href: '/legal/terms', label: 'Terms of use' },
    ],
  },
];

// Social links are rendered as literal anchors below: each has its own accessible
// label ("opens in a new tab") that a generic map could not express. Prefixed
// with `_` so the unused-list lint rule stays quiet while the data is kept.
const _SOCIAL_LINKS = [
  {
    label: 'X',
    href: 'https://x.com/munene254_',
    type: 'x',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/john-walter-munene/Drill-Lyrics-Ke',
    type: 'github',
  },
];

const CURRENT_YEAR = new Date().getFullYear();

function FooterBrand() {
  return (
    <Link
      href="/"
      className="site-footer__brand"
      aria-label="Drill Lyrics KE home"
    >
      <span className="site-header__mark" aria-hidden="true">
        DL
      </span>

      <span>
        Drill Lyrics <KenyanFlag className="site-footer__flag" />
      </span>
    </Link>
  );
}

function FooterNavigation() {
  return (
    <div className="site-footer__grid">
      {FOOTER_SECTIONS.map((section) => (
        <nav
          key={section.title}
          aria-label={section.label}
        >
          <h2>{section.title}</h2>

          <ul>
            {section.links.map((link) => (
              <li key={`${section.title}-${link.href}-${link.label}`}>
                <Link href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
}


function FooterSocialLinks() {
  return (
    <div>
      <span className="site-footer__promise-label">
        Follow the project
      </span>

      <p>
        Follow the journey as we document and celebrate
        the Kenyan drill scene.
      </p>

      <div className="site-footer__actions">
        <a
          href="https://x.com/munene254_"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Drill Lyrics KE on X (opens in a new tab)"
          className="btn btn--sm"
        >
          <span aria-hidden="true" className="font-bold">
            𝕏
          </span>
          X
          <span aria-hidden="true">↗</span>
        </a>

        <a
          href="https://github.com/john-walter-munene/Drill-Lyrics-Ke"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Drill Lyrics KE on GitHub (opens in a new tab)"
          className="btn btn--sm"
        >
          <span aria-hidden="true">⌘</span>
          GitHub
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}

function FooterCopyright() {
  return (
    <div className="site-footer__copyright">
      <p className="site-footer__local">
        <KenyanFlag className="site-footer__flag" />
        <span>Built for the Kenyan drill community</span>
      </p>

      <p>
        © {CURRENT_YEAR} Drill Lyrics KE.
        <span> All rights reserved.</span>
      </p>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div
        className="site-footer__topline"
        aria-hidden="true"
      />

      <div className="container site-footer__inner">

        {/* Brand and editorial identity */}
        <div className="site-footer__intro">

          <div className="site-footer__about">
            <FooterBrand />

            <p className="site-footer__eyebrow">
              Kenyan drill, in its own words.
            </p>

            <p>
              Drill Lyrics KE is a home for Kenyan drill lyrics,
              artists, and the culture behind the music. Explore
              the catalogue, discover the voices shaping the scene,
              and help build a reliable record of the words and
              stories behind the tracks.

            </p>

            <div className="site-footer__actions">
              <Link
                href="/songs"
                className="btn btn--primary btn--sm"
              >
                Explore lyrics
              </Link>

              <Link
                href="/artists"
                className="btn btn--sm"
              >
                Discover artists
              </Link>

              <Link
                href="/submit"
                className="btn btn--sm"
              >
                Contribute lyrics
              </Link>
            </div>

            <div className="site-footer__social">
              <FooterSocialLinks />
            </div>
          </div>

          {/* Editorial commitment */}
          <div className="site-footer__promise">
            <span className="site-footer__promise-label">
              Our editorial approach
            </span>

            <h2>
              Document the music.
              Respect its creators.
            </h2>

            <p>
              We aim to publish accurate lyrics with useful
              context and links to source material. Community
              submissions are reviewed before publication,
              and unverified details should be treated
              accordingly.

              We respect the rights of artists, writers,
              and other rights holders.
            </p>

            <Link href="/about">
              About the project
              <span aria-hidden="true"> →</span>
            </Link>
          </div>

        </div>

        {/* Main navigation */}
        <FooterNavigation />

        {/* Rights and copyright information */}
        <div className="site-footer__note">

          <p>
            <strong>Respect the original work.</strong>{' '}

            Where available, music videos are embedded from
            YouTube. Drill Lyrics KE does not host those videos
            or the associated audio files.

            Lyrics and other creative works remain subject to
            the rights of their respective owners.

            For rights-related concerns, visit our{' '}

            <Link href="/legal/rights">
              rights and takedowns page
            </Link>.
          </p>

          <FooterCopyright />

        </div>

      </div>
    </footer>
  );
}