
import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata } from '../../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Rights & takedowns',
  description:
    'Learn how Drill Lyrics KE respects copyright, handles artist permissions, and responds to content removal requests.',
  path: '/legal/rights',
});

export default function RightsPage() {
  return (
    <main className="container">
      <header className="page-head">
        <h1>Rights &amp; takedowns</h1>
        <p className="muted">
          Drill Lyrics KE exists to document and celebrate Kenyan drill
          while respecting the rights of the people who create its music.
          Lyrics, recordings, artwork, photographs, and other creative
          works may be protected by copyright or other rights.
        </p>
      </header>

      <p className="muted">
        Our software is open source, but that does not make the music,
        lyrics, artwork, or other third-party content free to reproduce.
        We aim to publish material with appropriate permission and
        respond promptly when a rights holder raises a concern.
      </p>

      <h2>If you are a rights holder</h2>

      <p className="muted">
        If you believe content on Drill Lyrics KE uses your work without
        permission, contact us with enough information to identify the
        material and understand your request.
      </p>

      <ol className="muted" style={{ lineHeight: 1.9 }}>
        <li>
          Identify the work, such as the song title, artist, or specific
          lyrics or artwork in question.
        </li>
        <li>
          Share a link to the relevant page and explain your relationship
          to the work or the rights you represent.
        </li>
        <li>
          Tell us whether you are requesting removal, correction, or
          another resolution.
        </li>
      </ol>

      <p className="muted">
        We will review the request and may temporarily unpublish the
        disputed material while investigating. We may contact you if
        additional information is needed and will record the request
        and its outcome.
      </p>

      <h2>If you are an artist</h2>

      <p className="muted">
        Artists are welcome to contribute lyrics, suggest songs, and
        help us improve information about their music. You can also
        request corrections or removal of material relating to your
        catalogue.
      </p>

      <p className="muted">
        Start by visiting <Link href="/submit">Submit lyrics</Link> or
        contact us through the <Link href="/support">support page</Link>.
        A submission or artist suggestion does not automatically mean
        that an artist or rights holder has verified or approved it.
      </p>

      <h2>Music and third-party platforms</h2>

      <p className="muted">
        Where songs or videos are played through embedded services such
        as YouTube, the recordings remain hosted by those platforms.
        Drill Lyrics KE does not claim ownership of those recordings or
        control their availability.
      </p>

      <h2>About the code</h2>

      <p className="muted">
        Drill Lyrics KE is an open-source software project. Its software
        licence applies to the code and does not grant permission to
        reproduce or distribute third-party lyrics, recordings,
        artwork, artist names, or other protected material.
      </p>

      <h2>Our commitment</h2>

      <p className="muted">
        We want artists, writers, rights holders, and listeners to feel
        that the project treats their work with respect. Our aim is to
        build a useful archive of Kenyan drill without disregarding the
        people and creative rights behind the music.
      </p>
    </main>
  );
}