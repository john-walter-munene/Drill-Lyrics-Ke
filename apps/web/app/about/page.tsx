
import Link from 'next/link';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata({
  title: 'About Drill Lyrics KE',
  description:
    'Drill Lyrics KE is an open-source music discovery and lyrics platform built around Kenyan drill. Discover artists, follow lyrics, understand the bars and explore the culture.',
  path: '/about',
});

export const revalidate = 3600;

const CORE_EXPERIENCE = [
  {
    number: '01',
    title: 'Discover the music',
    description:
      'Find Kenyan drill songs and explore the artists behind them. We are building an organised catalogue that makes music easier to search, discover and revisit.',
  },
  {
    number: '02',
    title: 'Play and follow the lyrics',
    description:
      'Open a song and experience its music alongside its lyrics. Our goal is to make following the bars feel like part of listening, with line-by-line highlighting and timing where synchronized lyrics are available.',
  },
  {
    number: '03',
    title: 'Understand the bars',
    description:
      'Kenyan drill carries its own language, wordplay and references. We want to make room for explanations of Sheng, slang and cultural context so listeners can understand more of what they hear.',
  },
  {
    number: '04',
    title: 'Explore the artist',
    description:
      'Move beyond one track. Discover an artist’s other releases, find their original YouTube channel and learn more about the people creating the music.',
  },
];

const PLATFORM_AREAS = [
  {
    title: 'Music and lyrics',
    status: 'The foundation',
    description:
      'A searchable song catalogue connected to lyrics, playback and the information that helps people experience each track.',
  },
  {
    title: 'Artist discovery',
    status: 'Growing',
    description:
      'Artist profiles, channel suggestions and organised releases that help listeners discover emerging and established Kenyan drill artists.',
  },
  {
    title: 'Community contributions',
    status: 'Part of the platform',
    description:
      'A way for listeners and contributors to submit lyrics, suggest songs and artists, and help correct or improve information in the catalogue.',
  },
  {
    title: 'Playlists and competitions',
    status: 'Future direction',
    description:
      'Community-curated playlists, themed competitions, voting and challenges that give fans more ways to participate in the culture.',
  },
  {
    title: 'Drill TV',
    status: 'Future direction',
    description:
      'A place to discover drill-related interviews, podcasts, commentary, conversations and short-form content from original creators.',
  },
  {
    title: 'Artist support',
    status: 'Future direction',
    description:
      'Ways to connect discovery with direct artist support, potentially including artist storefronts and merchandise.',
  },
];

const CONTRIBUTION_TYPES = [
  {
    title: 'Listeners and fans',
    description:
      'Suggest missing songs and artists, report mistakes and contribute knowledge about the music.',
  },
  {
    title: 'Artists and rights holders',
    description:
      'Help us identify official channels, improve artist information and address the documentation of your work.',
  },
  {
    title: 'Writers and culture enthusiasts',
    description:
      'Help explain the language, references, stories and people that shape Kenyan drill.',
  },
  {
    title: 'Developers and designers',
    description:
      'Improve the player, catalogue, accessibility, infrastructure and overall experience through the open-source project.',
  },
];

export default function AboutPage() {
  return (
    <main className="container about-page">
      <header className="about-page__hero">
        <p className="about-page__eyebrow">Drill Lyrics KE 🇰🇪</p>
        <h1>The home of Kenyan drill. One track at a time.</h1>

        <p className="about-page__lead">
          Drill Lyrics KE is an open-source music discovery and lyrics
          platform built around Kenyan drill. It brings music, lyrics,
          artist discovery and the culture around the sound into one
          connected experience.
        </p>

        <p className="about-page__lead about-page__lead--secondary">
          We want fans to understand the bars, discover emerging
          artists, explore the scene and take part in building a
          better record of the music.
        </p>

        <div className="about-page__actions">
          <Link href="/songs" className="btn btn--primary">
            Explore the music
          </Link>
          <Link href="/artists" className="btn">
            Discover artists
          </Link>
        </div>
      </header>

      <section className="about-page__section">
        <div className="about-page__section-heading">
          <p className="about-page__eyebrow">01 / The vision</p>
          <h2>Kenyan drill deserves a home of its own.</h2>
        </div>

        <p>
          Kenyan drill is more than music. It is sound, language,
          identity, neighbourhoods, creativity, stories and community.
          Every track carries something: the artist behind it, the
          words they chose, the experiences they express and the
          culture that surrounds the sound.
        </p>

        <p>
          But experiencing all of this can mean moving between
          different platforms. You might discover a song on YouTube,
          search elsewhere for its lyrics, visit social media to find
          the artist and rely on conversations to understand a phrase
          or reference.
        </p>

        <p>
          We are building Drill Lyrics KE to connect those experiences.
          The song is our starting point. From there, listeners can
          follow its lyrics, understand its language, discover its
          artist and explore more of the scene.
        </p>

        <blockquote className="about-page__statement">
          Artists keep their existing platforms. Fans get a better
          way to experience the music. The community helps build
          the library.
        </blockquote>
      </section>

      <section className="about-page__section">
        <div className="about-page__section-heading">
          <p className="about-page__eyebrow">02 / The experience</p>
          <h2>Start with the music. Go deeper into the culture.</h2>
        </div>

        <p>
          The heart of Drill Lyrics KE is the relationship between
          a song and the information around it. We want opening a
          track to be the beginning of a richer experience, not
          the end of a search.
        </p>

        <div className="about-page__experience">
          {CORE_EXPERIENCE.map((item) => (
            <article className="about-page__experience-item" key={item.number}>
              <span className="about-page__number">{item.number}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="about-page__player-note">
          <h3>The lyrics experience matters.</h3>
          <p>
            We take inspiration from synchronized-lyrics experiences
            and the seamless feel of dedicated music players. The
            intention is to bring playback and lyrics together:
            highlight the current line, keep the words readable and
            make it easier to follow the track as it progresses.
          </p>
          <p>
            Lyrics can be unsynchronized or synchronized. We clearly
            distinguish between the two rather than suggesting that
            every song already has accurate timing.
          </p>
        </div>
      </section>

      <section className="about-page__section">
        <div className="about-page__section-heading">
          <p className="about-page__eyebrow">03 / The platform</p>
          <h2>More than a lyrics website.</h2>
        </div>

        <p>
          Drill Lyrics KE is designed as a connected music and culture
          platform. Its foundation is a searchable music catalogue
          and lyrics experience. Other areas can grow from that
          foundation as the product and community develop.
        </p>

        <div className="about-page__platform-grid">
          {PLATFORM_AREAS.map((area) => (
            <article className="panel about-page__platform-card" key={area.title}>
              <span className="about-page__status">{area.status}</span>
              <h3>{area.title}</h3>
              <p>{area.description}</p>
            </article>
          ))}
        </div>

        <p className="about-page__note">
          These areas are not all available today. The immediate
          priority is to establish a reliable catalogue, a useful
          lyrics experience and a contribution and review process
          that can support the platform as it grows.
        </p>
      </section>

      <section className="about-page__section">
        <div className="about-page__section-heading">
          <p className="about-page__eyebrow">04 / The community library</p>
          <h2>The community helps build the record.</h2>
        </div>

        <p>
          A music catalogue becomes more valuable when the people
          who know the music can help improve it. A listener might
          know a missing release. Someone familiar with Sheng might
          understand a phrase that others have misheard. An artist
          might help us identify an official channel or correct
          information about their work.
        </p>

        <p>
          Drill Lyrics KE supports contributions from guests and
          community members. People can submit lyrics and suggest
          artist channels. These contributions do not automatically
          become public entries: staff review is required before
          lyrics or imported song candidates are published.
        </p>

        <div className="about-page__contributions">
          {CONTRIBUTION_TYPES.map((item) => (
            <article className="about-page__contribution" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>

        <div className="about-page__actions">
          <Link href="/submit" className="btn btn--primary">
            Contribute lyrics
          </Link>
          <Link href="/artists/suggest" className="btn">
            Suggest an artist
          </Link>
          <Link href="/developers" className="btn">
            Contribute to the code
          </Link>
        </div>
      </section>

      <section className="about-page__section">
        <div className="about-page__section-heading">
          <p className="about-page__eyebrow">05 / How we operate</p>
          <h2>Built around the music, not against its creators.</h2>
        </div>

        <p>
          Drill Lyrics KE does not aim to become another music
          streaming service or replace the platforms artists
          already use. We connect information about the music
          while keeping its original source visible.
        </p>

        <div className="about-page__principles">
          <article>
            <h3>Music stays at its source</h3>
            <p>
              Music videos are embedded from YouTube. We use
              supported platform integrations to work with
              playback and public metadata; we do not download
              or rehost music recordings.
            </p>
          </article>

          <article>
            <h3>Information is reviewed</h3>
            <p>
              Contributions go through staff review before
              publication. Accuracy, clear attribution and
              useful context matter more than simply adding
              more entries.
            </p>
          </article>

          <article>
            <h3>Artists retain their identity</h3>
            <p>
              Artist profiles and catalogue entries are there
              to help people discover creators and their work.
              They do not make Drill Lyrics KE the owner of
              that work.
            </p>
          </article>

          <article>
            <h3>The software is open source</h3>
            <p>
              The project welcomes people who want to inspect,
              improve and contribute to the software. The code
              licence does not grant rights to music, lyrics,
              artwork or recordings.
            </p>
          </article>
        </div>

        <div className="about-page__source-note">
          <h3>About the music and lyrics</h3>
          <p>
            Music, recordings, lyrics and artwork may be
            protected by copyright. Contributions and
            publication are subject to the project's rights
            policies. Artists and rights holders can contact
            us about material they own or represent.
          </p>
          <Link href="/legal/rights">
            Read rights and takedown information →
          </Link>
        </div>
      </section>

      <section className="about-page__section">
        <div className="about-page__section-heading">
          <p className="about-page__eyebrow">06 / The project</p>
          <h2>Open source. Built for the culture.</h2>
        </div>

        <p>
          Drill Lyrics KE is developed as an open-source project.
          That means the software and its development can be
          inspected, discussed and improved by contributors.
          We want the project to grow through practical work,
          transparent decisions and participation from people
          who care about Kenyan drill.
        </p>

        <p>
          The platform uses a Next.js web application, a NestJS
          API and PostgreSQL with Prisma. YouTube integrations
          support playback and channel metadata discovery.
          We favour a straightforward architecture and
          cost-conscious infrastructure, adding complexity
          only when the product needs it.
        </p>

        <div className="about-page__actions">
          <Link href="/developers" className="btn btn--primary">
            Explore the developer project
          </Link>
          <Link href="/support" className="btn">
            Support our work
          </Link>
        </div>
      </section>

      <section className="about-page__section about-page__future">
        <div className="about-page__section-heading">
          <p className="about-page__eyebrow">07 / Looking ahead</p>
          <h2>Start with Kenyan drill. Grow with the community.</h2>
        </div>

        <p>
          The first responsibility is to get the foundation right:
          a dependable catalogue, an enjoyable lyrics experience,
          useful artist discovery and a contribution process
          that respects the people and work being documented.
        </p>

        <p>
          As that foundation develops, there is room to explore
          community playlists, competitions, drill challenges,
          interviews, podcasts, short-form content and new ways
          for fans to support artists.
        </p>

        <p>
          In the longer term, the same approach could support
          other drill scenes across Africa and beyond. But we
          start here, with Kenyan drill, and build outward when
          the foundation is ready.
        </p>
      </section>

      <section className="about-page__closing">
        <p className="about-page__eyebrow">Drill Lyrics KE</p>
        <h2>One track at a time.</h2>
        <p>
          Discover the music. Understand the bars. Find the
          artists. Help document the culture.
        </p>

        <div className="about-page__actions">
          <Link href="/songs" className="btn btn--primary">
            Explore Kenyan drill
          </Link>
          <Link href="/submit" className="btn">
            Make a contribution
          </Link>
        </div>
      </section>
    </main>
  );
}