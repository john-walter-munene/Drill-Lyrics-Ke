
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import KenyanFlag from './KenyanFlag';
import AuthLinks from './AuthLinks';

const NAV_LINKS = [
  { href: '/search', label: 'Search' },
  { href: '/songs', label: 'Songs & Lyrics' },
  { href: '/artists', label: 'Artists' },
  { href: '/djs', label: 'DJs & Mixes' },
  { href: '/podcasts', label: 'Podcasts' },
  { href: '/events', label: 'Events' },
];

const EXPLORE_SECTIONS = [
  {
    title: 'Discover',
    links: [
      { href: '/search', label: 'Search the catalogue' },
      { href: '/songs', label: 'Songs & lyrics' },
      { href: '/artists', label: 'Explore artists' },
      { href: '/artists/suggest', label: 'Suggest an artist' },
    ],
  },
  {
    title: 'The scene',
    links: [
      { href: '/djs', label: 'DJs & mixes' },
      { href: '/podcasts', label: 'Podcasts' },
      { href: '/events', label: 'Events' },
    ],
  },
  {
    title: 'About the project',
    links: [
      { href: '/about', label: 'Our story' },
      { href: '/developers', label: 'For developers' },
      { href: '/support', label: 'Support the project' },
    ],
  },
];

function isActiveRoute(pathname: string | null, href: string) {
  if (!pathname) return false;

  if (href === '/') return pathname === '/';

  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link
      href="/"
      className="site-header__brand"
      aria-label="Drill Lyrics KE home"
    >
      <span className="site-header__mark" aria-hidden="true">
        DL
      </span>

      <span className="site-header__brand-copy">
        <strong>
          Drill Lyrics <KenyanFlag className="site-header__brand-flag" />
        </strong>

        <small>Kenyan drill, in its own words.</small>
      </span>
    </Link>
  );
}

function LocalIdentityBar() {
  return (
    <div className="site-header__local">
      <div className="site-header__local-inner">
        <p>
          <KenyanFlag className="site-header__local-flag" />
          <span>A Kenyan home for Kenyan drill</span>
        </p>

        <span className="site-header__local-note">
          Music <span aria-hidden="true">·</span> Lyrics{' '}
          <span aria-hidden="true">·</span> Culture
        </span>
      </div>
    </div>
  );
}

function DesktopNavigation({
  pathname,
}: {
  pathname: string | null;
}) {
  return (
    <nav className="site-header__nav" aria-label="Main navigation">
      {NAV_LINKS.map((link) => {
        const active = isActiveRoute(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              'site-header__nav-link',
              active ? 'site-header__nav-link--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={active ? 'page' : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavigationSections({
  pathname,
  onNavigate,
}: {
  pathname: string | null;
  onNavigate: () => void;
}) {
  return (
    <>
      {EXPLORE_SECTIONS.map((section) => (
        <section
          className="site-header__mobile-section"
          key={section.title}
        >
          <h2>{section.title}</h2>

          <ul>
            {section.links.map((link) => {
              const active = isActiveRoute(pathname, link.href);

              return (
                <li key={`${section.title}-${link.href}`}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    className={
                      active
                        ? 'site-header__mobile-link site-header__mobile-link--active'
                        : 'site-header__mobile-link'
                    }
                    aria-current={active ? 'page' : undefined}
                  >
                    {link.label}
                    {active && (
                      <span className="site-header__active-indicator">
                        Current page
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

function MobileMenu({
  pathname,
}: {
  pathname: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => setIsOpen(false);

  // Close the menu whenever navigation changes.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close on Escape or when clicking outside the mobile menu. The panel also
  // stops the page scrolling underneath it: on a phone the list is taller than
  // the viewport, and scrolling the page behind it is never what was meant.
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
        buttonRef.current?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="site-header__menu" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className="site-header__menu-button"
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isOpen}
        aria-controls="drill-lyrics-mobile-navigation"
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <span className="site-header__menu-label">
          {isOpen ? 'Close' : 'Menu'}
        </span>

        <span
          className={`site-header__menu-icon ${
            isOpen ? 'site-header__menu-icon--open' : ''
          }`}
          aria-hidden="true"
        >
          <span />
          <span />
        </span>
      </button>

      {isOpen && (
        <nav
          id="drill-lyrics-mobile-navigation"
          className="site-header__mobile-panel"
          aria-label="Mobile navigation"
        >
          {/* The brand is already in the header row directly above this panel;
              repeating it here pushed the first link a full screen down. */}
          <div className="site-header__mobile-heading">
            <p>Explore the Kenyan drill scene</p>
            <span aria-hidden="true">↓</span>
          </div>

          <MobileNavigationSections
            pathname={pathname}
            onNavigate={closeMenu}
          />

          <div className="site-header__mobile-account">
            <AuthLinks />
          </div>

          <Link
            href="/submit"
            onClick={closeMenu}
            className="btn btn--primary site-header__mobile-submit"
          >
            Contribute lyrics
          </Link>

          <p className="site-header__mobile-tagline">
            Document the music. Respect its creators.
          </p>
        </nav>
      )}
    </div>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);

  // Publish where the header ends as a CSS variable. The identity bar wraps to
  // two lines on narrow screens, so the header is taller than its row; the
  // phone menu sheet (fixed, so it can scroll independently) needs that edge.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const publish = () => {
      header.style.setProperty(
        '--site-header-bottom',
        `${Math.round(header.getBoundingClientRect().bottom)}px`,
      );
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    window.addEventListener('resize', publish);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
    };
  }, []);

  return (
    <header className="site-header" ref={headerRef}>
      <LocalIdentityBar />

      <div className="site-header__inner">
        <Brand />

        <DesktopNavigation pathname={pathname} />

        <div className="site-header__desktop-actions">
          <Link href="/submit" className="btn btn--primary site-header__submit">
            Contribute lyrics
          </Link>

          <AuthLinks />
        </div>

        <div className="site-header__mobile-actions">
          <Link
            href="/submit"
            className="btn btn--primary btn--sm site-header__quick-submit"
          >
            Contribute
          </Link>

          <MobileMenu pathname={pathname} />
        </div>
      </div>
    </header>
  );
}