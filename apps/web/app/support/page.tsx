
import Link from "next/link";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Support the project",
  description:
    "Help keep Drill Lyrics KE free and independent — what the project is for, how it is funded and how to get involved.",
  path: "/support",
});

const principles = [
  {
    id: "purpose",
    symbol: "♪",
    title: "Our purpose",
    text: "Give Kenyan drill a home where its music, lyrics, artists, and stories can be discovered and documented.",
  },
  {
    id: "approach",
    symbol: "≋",
    title: "Our approach",
    text: "Connect music discovery with lyrics, synchronized playback, and explanations of the language and references behind the bars.",
  },
  {
    id: "community",
    symbol: "◎",
    title: "Our community",
    text: "Build a shared music library through contributions from listeners, artists, and people who care about the Kenyan drill scene.",
  },
];

const buttonClass =
  "about-page__button";

export default function AboutPage() {
  return (
    <main className="about-page container" aria-labelledby="about-heading">
      <div>
        <header className="about-page__header">
          <p className="about-page__eyebrow">About the project</p>

          <h1 id="about-heading">
            The home of Kenyan drill.{" "}
            <span>One track at a time.</span>
          </h1>

          <p className="about-page__intro">
            Drill Lyrics KE is an open-source music discovery and lyrics
            platform built around Kenyan drill. We bring together songs,
            artists, lyrics, and the culture behind the music to make the
            scene easier to discover, understand, and experience.
          </p>

          <p className="muted">
            Kenyan drill has its own sound, language, stories, and identity.
            Our goal is to help document that creativity and make it
            accessible to the people who create it and the people who
            listen to it.
          </p>
        </header>

        <section
          className="about-page__principles"
          aria-label="Our guiding principles"
        >
          {principles.map((principle) => (
            <article
              className="panel about-page__principle"
              key={principle.id}
            >
              <span
                className="about-page__symbol"
                aria-hidden="true"
              >
                {principle.symbol}
              </span>

              <h2>{principle.title}</h2>
              <p className="muted">{principle.text}</p>
            </article>
          ))}
        </section>

        <div className="about-page__columns">
          <section className="panel about-page__section">
            <h2>Music, lyrics &amp; discovery</h2>

            <p>
              At the heart of Drill Lyrics KE is a growing catalogue of
              Kenyan drill music. Listeners can discover songs and artists,
              explore lyrics, and follow music through an integrated
              listening experience.
            </p>

            <p>
              We want lyrics to be more than blocks of text. Where
              synchronization is available, listeners can follow the words
              as a song plays. Annotations can also help explain Sheng,
              slang, and cultural references that give the music its meaning.
            </p>

            <p className="muted">
              Music videos are embedded from YouTube. We reference and
              document music rather than downloading or rehosting artists'
              recordings.
            </p>

            <Link href="/songs" className={buttonClass}>
              Explore songs <span aria-hidden="true">→</span>
            </Link>
          </section>

          <section className="panel about-page__section">
            <h2>Trust &amp; community</h2>

            <p>
              The library grows through community participation. Listeners
              can contribute lyrics, suggest corrections, and help improve
              the information surrounding songs and artists.
            </p>

            <p>
              Contributions and imported song suggestions go through
              editorial review before publication. This helps us maintain
              quality while giving the community a meaningful role in
              documenting its music.
            </p>

            <p className="muted">
              Artists retain their identity and their existing platforms.
              Drill Lyrics KE exists to support discovery and appreciation,
              not to replace the people or platforms behind the music.
            </p>

            <Link href="/legal/rights" className={buttonClass}>
              Our rights policy <span aria-hidden="true">→</span>
            </Link>
          </section>
        </div>

        <section className="panel about-page__community">
          <div>
            <p className="about-page__eyebrow">Built in public</p>

            <h2>A project the community can help build.</h2>

            <p className="muted">
              Drill Lyrics KE is also an open-source software project.
              Developers, designers, writers, music enthusiasts, and
              listeners are welcome to help improve the platform and
              contribute to its growing library.
            </p>
          </div>

          <div className="about-page__actions">
            <a
              href="https://github.com/john-walter-munene/Drill-Lyrics-Ke"
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClass} about-page__button--primary`}
            >
              Explore on GitHub <span aria-hidden="true">↗</span>
            </a>

            <Link href="/developers" className={buttonClass}>
              Developer guide <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <nav
          className="about-page__links"
          aria-label="Explore Drill Lyrics KE"
        >
          <Link href="/artists" className="btn btn--primary">
            Discover artists
          </Link>

          <Link href="/submit" className="btn">
            Contribute lyrics
          </Link>

          <Link href="/support" className="btn">
            Support the project
          </Link>
        </nav>
      </div>
    </main>
  );
}