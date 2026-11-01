import Link from "next/link";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Support the project",
  description:
    "Help keep Drill Lyrics KE free and independent — what the project is for, how it is funded and how to get involved.",
  path: "/support",
});

const BMC_URL = "https://buymeacoffee.com/Munene254_";

const buttonClass = "about-page__button";

const principles = [
  {
    id: "purpose",
    symbol: "♪",
    title: "What it's for",
    text: "Give Kenyan drill a home where its music, lyrics, artists, and stories can be discovered and documented.",
  },
  {
    id: "funding",
    symbol: "≋",
    title: "How it's funded",
    text: "Drill Lyrics KE is independent and free to use. There are no paywalls, and the project runs on community support.",
  },
  {
    id: "involved",
    symbol: "◎",
    title: "How to get involved",
    text: "Chip in with a coffee, contribute lyrics, or help build the platform. Every bit keeps the scene documented.",
  },
];

export default function SupportPage() {
  return (
    <main className="about-page container" aria-labelledby="support-heading">
      <div>
        <header className="about-page__header">
          <p className="about-page__eyebrow">Support the project</p>

          <h1 id="support-heading">
            Help keep it free. <span>Help keep it independent.</span>
          </h1>

          <p className="about-page__intro">
            Drill Lyrics KE is an open-source music discovery and lyrics
            platform built around Kenyan drill. It stays free and independent
            because of people who care about the scene and want to see it
            documented properly.
          </p>

          <p className="muted">
            If the project has helped you find a new artist or finally
            understand a line, here are a few ways to give something back.
          </p>

          <div className="about-page__actions">
            <a
              href={BMC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClass} about-page__button--primary`}
            >
              Buy me a coffee ☕ <span aria-hidden="true">↗</span>
            </a>
          </div>
        </header>

        <section
          className="about-page__principles"
          aria-label="About supporting the project"
        >
          {principles.map((principle) => (
            <article
              className="panel about-page__principle"
              key={principle.id}
            >
              <span className="about-page__symbol" aria-hidden="true">
                {principle.symbol}
              </span>

              <h2>{principle.title}</h2>
              <p className="muted">{principle.text}</p>
            </article>
          ))}
        </section>

        <div className="about-page__columns">
          <section className="panel about-page__section">
            <h2>Buy me a coffee</h2>

            <p>
              A small contribution helps cover hosting and the time it takes
              to keep the library growing, from adding songs to reviewing
              community submissions.
            </p>

            <p className="muted">
              Music videos are embedded from YouTube. We reference and
              document music rather than downloading or rehosting artists'
              recordings.
            </p>

            <a
              href={BMC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClass} about-page__button--primary`}
            >
              Buy me a coffee <span aria-hidden="true">↗</span>
            </a>
          </section>

          <section className="panel about-page__section">
            <h2>Other ways to help</h2>

            <p>
              Not able to chip in financially? Contributing lyrics, suggesting
              corrections, and sharing the platform with other listeners all
              make a real difference.
            </p>

            <p className="muted">
              Contributions go through editorial review before publication, so
              the library stays trustworthy as it grows.
            </p>

            <Link href="/submit" className={buttonClass}>
              Contribute lyrics <span aria-hidden="true">→</span>
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
          <Link href="/songs" className="btn btn--primary">
            Explore songs
          </Link>

          <Link href="/artists" className="btn">
            Discover artists
          </Link>

          <Link href="/legal/rights" className="btn">
            Our rights policy
          </Link>
        </nav>
      </div>
    </main>
  );
}