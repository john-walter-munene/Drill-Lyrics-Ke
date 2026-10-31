
import Link from 'next/link';
import { pageMetadata } from '../../lib/seo';

const REPOSITORY =
  'https://github.com/john-walter-munene/Drill-Lyrics-Ke';

const CONTRIBUTING = `${REPOSITORY}/blob/main/CONTRIBUTING.md`;
const ISSUES = `${REPOSITORY}/issues`;

export const metadata = pageMetadata({
  title: 'Build with us',
  description:
    'Help build Drill Lyrics KE: an open-source home for Kenyan drill, synchronized lyrics, music discovery and community knowledge. Explore the code, contribute ideas and help shape the platform.',
  path: '/developers',
});

export const revalidate = 3600;

const CONTRIBUTION_AREAS = [
  {
    number: '01',
    category: 'Frontend & experience',
    title: 'Make the listening experience better',
    body: 'Improve playback controls, lyric synchronization, annotations, keyboard navigation, accessibility and the overall experience of following a song.',
    skills: 'React · Next.js · TypeScript · UI/UX',
  },
  {
    number: '02',
    category: 'Catalogue & discovery',
    title: 'Help build the music library',
    body: 'Improve song and artist discovery, search, catalogue quality, channel imports and the tools used to review community contributions.',
    skills: 'Data modelling · Search · Content tools',
  },
  {
    number: '03',
    category: 'Quality & reliability',
    title: 'Make it work everywhere',
    body: 'Test the platform on real devices, improve responsive layouts, identify bugs and make the experience reliable on everyday Android phones, tablets and desktop browsers.',
    skills: 'Testing · Responsive design · Accessibility',
  },
  {
    number: '04',
    category: 'Backend & infrastructure',
    title: 'Strengthen the foundations',
    body: 'Improve API contracts, database design, performance, security, documentation and the Docker-first developer workflow.',
    skills: 'NestJS · PostgreSQL · Prisma · Docker',
  },
  {
    number: '05',
    category: 'Documentation',
    title: 'Make the project easier to understand',
    body: 'Improve setup instructions, technical documentation, contribution guides and explanations that help new contributors get oriented.',
    skills: 'Technical writing · Documentation',
  },
  {
    number: '06',
    category: 'Community & music',
    title: 'Help preserve the culture',
    body: 'Review submissions, suggest artists, identify missing information and help make the catalogue a more dependable record of Kenyan drill.',
    skills: 'Music knowledge · Research · Community',
  },
];

const STACK = [
  ['Web application', 'Next.js App Router, React and TypeScript'],
  ['API', 'NestJS modules and a single frontend API boundary'],
  ['Database', 'PostgreSQL and Prisma'],
  ['Shared logic', 'Lyrics parsing, timing and domain types'],
  ['Playback', 'YouTube IFrame Player API; media is not rehosted'],
  ['Development environment', 'Docker Compose for the web app, API and database'],
];

const FIRST_STEPS = [
  {
    number: '01',
    title: 'Get familiar with the project',
    body: 'Understand what Drill Lyrics KE is building, how the application is organised and the principles guiding the platform.',
  },
  {
    number: '02',
    title: 'Read the contribution guide',
    body: 'Check the setup instructions, contribution expectations and workflow before making changes.',
  },
  {
    number: '03',
    title: 'Find something worth improving',
    body: 'Browse existing issues or raise an idea. For larger changes, discuss the approach before investing time in implementation.',
  },
  {
    number: '04',
    title: 'Make your contribution',
    body: 'Keep changes focused, explain the problem being solved, update relevant documentation and provide screenshots when appropriate.',
  },
];

function ExternalLink({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}

interface ContributionArea {
  number: string;
  category: string;
  title: string;
  body: string;
  skills: string;
}

function ContributionCard({ area }: { area: ContributionArea }) {
  return (
    <li className="panel developer-page__contribution-card">
      <div className="developer-page__card-top">
        <span className="developer-page__number">{area.number}</span>
        <span className="developer-page__category">{area.category}</span>
      </div>

      <h3>{area.title}</h3>

      <p className="muted">{area.body}</p>

      <p className="developer-page__skills">{area.skills}</p>
    </li>
  );
}

export default function DevelopersPage() {
  return (
    <main className="container developer-page">

      {/* Hero */}
      <section className="developer-page__hero">
        <p className="developer-page__eyebrow">
          Open source <span aria-hidden="true">·</span> Kenyan drill{' '}
          <span aria-hidden="true">·</span> Community built
        </p>

        <h1>
          Help build a better way to experience Kenyan drill.
        </h1>

        <p className="developer-page__lead">
          Drill Lyrics KE brings music, lyrics, artists and cultural context
          together in one place. We're building a platform that gives Kenyan
          drill a home on the internet, and we're opening up the process for
          people who want to help make it better.
        </p>

        <p className="developer-page__lead">
          Whether you're a developer, designer, tester, music enthusiast or
          someone with a good idea, there's room to contribute.
        </p>

        <div className="developer-page__actions">
          <ExternalLink
            href={REPOSITORY}
            className="btn btn--primary"
          >
            Explore the GitHub repository
          </ExternalLink>

          <ExternalLink href={CONTRIBUTING} className="btn">
            Read the contribution guide
          </ExternalLink>
        </div>

        <p className="muted developer-page__note">
          Contributions are voluntary. There is no promise of payment,
          employment or future compensation. The codebase is MIT licensed;
          lyrics, music, artwork and artists' identities remain subject to
          their respective owners' rights.
        </p>
      </section>

      {/* Why contribute */}
      <section
        className="developer-page__section developer-page__mission"
        aria-labelledby="mission-heading"
      >
        <p className="developer-page__eyebrow">
          Why we're building
        </p>

        <h2 id="mission-heading">
          More than a lyrics website.
        </h2>

        <p className="muted developer-page__section-intro">
          Music is more than a recording. It's the words, the artists, the
          stories, the scenes and the communities that give it meaning.
          We're building tools to make that culture easier to discover,
          understand and document.
        </p>

        <p className="muted">
          A good contribution doesn't always have to be a big feature.
          Sometimes it's a bug fixed, a confusing interaction improved,
          a useful document written or a missing piece of information
          brought to our attention.
        </p>
      </section>

      {/* Contribution opportunities */}
      <section
        className="developer-page__section"
        aria-labelledby="areas-heading"
      >
        <p className="developer-page__eyebrow">
          Find your place
        </p>

        <h2 id="areas-heading">
          Different skills. One growing project.
        </h2>

        <p className="muted developer-page__section-intro">
          Here are some of the areas where contributions can make a
          meaningful difference.
        </p>

        <ul className="developer-page__cards">
          {CONTRIBUTION_AREAS.map((area) => (
            <ContributionCard key={area.number} area={area} />
          ))}
        </ul>
      </section>

      {/* Current focus */}
      <section
        className="developer-page__section developer-page__current"
        aria-labelledby="current-heading"
      >
        <div>
          <p className="developer-page__eyebrow">
            Current product direction
          </p>

          <h2 id="current-heading">
            Help us make every part of the experience count.
          </h2>

          <p className="muted">
            We're focused on building a dependable catalogue, refining
            the listening and lyrics experience, improving contribution
            and review workflows, and making the platform work well
            across real devices.
          </p>

          <p className="muted">
            You can explore the existing implementation and follow
            development through the repository and roadmap.
          </p>
        </div>

        <div className="developer-page__actions developer-page__actions--stacked">
          <Link className="btn btn--primary" href="/songs">
            Explore the catalogue
          </Link>

          <ExternalLink
            href={`${REPOSITORY}/blob/main/docs/roadmap.md`}
            className="btn"
          >
            Read the roadmap
          </ExternalLink>

          <Link className="btn" href="/submit">
            Contribute lyrics
          </Link>
        </div>
      </section>

      {/* Technology */}
      <section
        className="developer-page__section"
        aria-labelledby="stack-heading"
      >
        <p className="developer-page__eyebrow">
          Under the hood
        </p>

        <h2 id="stack-heading">
          A familiar stack, built for a focused product.
        </h2>

        <p className="muted developer-page__section-intro">
          Drill Lyrics KE uses a TypeScript-based architecture with
          separate application responsibilities and shared domain logic.
        </p>

        <dl className="developer-page__stack">
          {STACK.map(([term, description]) => (
            <div className="developer-page__stack-item" key={term}>
              <dt>{term}</dt>
              <dd className="muted">{description}</dd>
            </div>
          ))}
        </dl>

        <p className="muted">
          The repository is organised as a TypeScript monorepo. Start
          with the README for the project map and development runbook.
          Docker Compose is the supported local development setup.
        </p>
      </section>

      {/* Getting started */}
      <section
        className="developer-page__section"
        aria-labelledby="steps-heading"
      >
        <p className="developer-page__eyebrow">
          Getting involved
        </p>

        <h2 id="steps-heading">
          Your first contribution.
        </h2>

        <p className="muted developer-page__section-intro">
          New to the repository? Here's a straightforward way to get started.
        </p>

        <ol className="developer-page__steps">
          {FIRST_STEPS.map((step) => (
            <li key={step.number}>
              <span className="developer-page__step-number">
                {step.number}
              </span>

              <div>
                <strong>{step.title}</strong>
                <p className="muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="developer-page__actions">
          <ExternalLink
            href={CONTRIBUTING}
            className="btn btn--primary"
          >
            Read the contribution guide
          </ExternalLink>

          <ExternalLink href={ISSUES} className="btn">
            Browse GitHub issues
          </ExternalLink>

          <ExternalLink
            href={`${REPOSITORY}/blob/main/CODE_OF_CONDUCT.md`}
            className="btn"
          >
            Code of Conduct
          </ExternalLink>
        </div>
      </section>

      {/* Open source and rights */}
      <section
        className="developer-page__section developer-page__principles"
        aria-labelledby="principles-heading"
      >
        <h2 id="principles-heading">
          Building openly. Respecting the culture.
        </h2>

        <p className="muted">
          We welcome collaboration, discussion and thoughtful
          experimentation. We also take the rights of artists, songwriters,
          producers and other creators seriously.
        </p>

        <p className="muted">
          Open-source code does not make music, lyrics, recordings,
          artwork or personal information free to reproduce. Contributions
          must respect the project's licensing, content policies and
          community guidelines.
        </p>

        <div className="developer-page__actions">
          <ExternalLink
            href={`${REPOSITORY}/blob/main/LICENSE`}
            className="btn"
          >
            View the project license
          </ExternalLink>

          <Link href="/legal/rights" className="btn">
            Rights and takedowns
          </Link>
        </div>
      </section>

      {/* Closing invitation */}
      <section className="developer-page__closing">
        <p className="developer-page__eyebrow">
          Built with the scene
        </p>

        <h2>
          The best version of this project is still being built.
        </h2>

        <p className="muted">
          It can be shaped by the people who use it, the people who
          understand the music and the people who enjoy building useful
          things. If that sounds like you, we'd love to have you involved.
        </p>

        <div className="developer-page__actions">
          <ExternalLink
            href={REPOSITORY}
            className="btn btn--primary"
          >
            Join us on GitHub
          </ExternalLink>

          <Link href="/support" className="btn">
            Other ways to support the project
          </Link>

          <Link href="/about" className="btn">
            Learn about Drill Lyrics KE
          </Link>
        </div>
      </section>
    </main>
  );
}