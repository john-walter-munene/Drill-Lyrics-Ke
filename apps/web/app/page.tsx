import Link from 'next/link';
import { getHomeFeeds, listSongs } from '../api';
import { pageMetadata } from '../lib/seo';
import SongList from './songs/SongList';

export const metadata = pageMetadata({
  title: 'Drill Lyrics — Kenyan drill lyrics, synchronized',
  description:
    'The home of Kenyan drill. Read the bars while the music plays — synchronized lyrics, Sheng annotations, artists, DJs, podcasts and events.',
  path: '/',
});

const SECTIONS = [
  { href: '/songs', title: 'Songs', blurb: 'Browse the catalogue and follow the bars.' },
  { href: '/artists', title: 'Artists', blurb: 'Profiles, links and every release in one place.' },
  { href: '/djs', title: 'DJs', blurb: 'The people moving the scene, and what they spin.' },
  { href: '/podcasts', title: 'Podcasts', blurb: 'The conversations around the music.' },
  { href: '/events', title: 'Events', blurb: 'Where to catch drill live.' },
  { href: '/support', title: 'Support', blurb: 'Help keep Drill Lyrics free and independent.' },
];

export default async function HomePage() {
  // One feed request plus the catalogue: the featured list is the catalogue's
  // own order so it never disagrees with /songs.
  const [catalogue, feeds] = await Promise.all([listSongs({ page: 1 }, 0), getHomeFeeds()]);
  const featuredSongs = catalogue.items.slice(0, 6);

  // Only show a shelf that has something a visitor can act on, and never repeat
  // the featured list directly beneath itself.
  const featuredSlugs = new Set(featuredSongs.map((song) => song.slug));
  const syncedShelf = feeds.syncedSongs.filter((song) => !featuredSlugs.has(song.slug)).slice(0, 4);
  const newShelf = feeds.newSongs
    .filter((song) => !featuredSlugs.has(song.slug) && !syncedShelf.some((synced) => synced.slug === song.slug))
    .slice(0, 4);

  return (
    <main className="container">
      <section style={{ padding: '2rem 0 3rem', maxWidth: 720 }}>
        <p className="badge">Kenyan drill · one track at a time</p>
        <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 3.6rem)', lineHeight: 1.05, margin: '1rem 0' }}>
          Read the bars while the music plays.
        </h1>
        <p className="muted" style={{ fontSize: '1.05rem' }}>
          Drill Lyrics plays Kenyan drill from its original source and lines up the lyrics as it goes —
          with the Sheng, slang and references explained.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
          <Link href="#start-listening" className="btn btn--primary">
            Play a song
          </Link>
          <Link href="/submit" className="btn">
            Submit lyrics
          </Link>
        </div>
      </section>

      <section id="start-listening" className="home-listen" aria-labelledby="start-listening-title">
        <div className="home-listen__heading">
          <div>
            <p className="badge">Start here</p>
            <h2 id="start-listening-title">Choose a song and press play.</h2>
            <p className="muted">Playback starts here. Your queue follows the order shown, with previous and next controls in the player.</p>
          </div>
          <Link href="/songs" className="btn btn--sm">Browse all songs</Link>
        </div>
        {featuredSongs.length ? (
          <SongList songs={featuredSongs} />
        ) : (
          <div className="panel home-listen__empty">
            <p className="muted">The catalogue is ready for its first songs.</p>
            <Link href="/submit" className="btn btn--primary btn--sm">Contribute lyrics</Link>
          </div>
        )}
      </section>

      {syncedShelf.length ? (
        <section aria-labelledby="synced-title" style={{ marginTop: '2.5rem' }}>
          <div className="home-listen__heading">
            <div>
              <p className="badge">Timed and ready</p>
              <h2 id="synced-title">Synced this week.</h2>
              <p className="muted">Lyrics that follow the track line by line — press play and read along.</p>
            </div>
            <Link href="/songs" className="btn btn--sm">All songs</Link>
          </div>
          <SongList songs={syncedShelf} />
        </section>
      ) : null}

      {newShelf.length ? (
        <section aria-labelledby="new-title" style={{ marginTop: '2.5rem' }}>
          <div className="home-listen__heading">
            <div>
              <p className="badge">Fresh in the catalogue</p>
              <h2 id="new-title">New songs.</h2>
            </div>
          </div>
          <SongList songs={newShelf} />
        </section>
      ) : null}

      {feeds.emergingArtists.length ? (
        <section aria-labelledby="emerging-title" style={{ marginTop: '2.5rem' }}>
          <h2 id="emerging-title" style={{ fontSize: '1.1rem' }}>Emerging artists</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Artists building their catalogue here — the ones to know before everyone else does.
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: '.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            {feeds.emergingArtists.map((artist) => (
              <li key={artist.slug} className="panel">
                <Link href={`/artists/${artist.slug}`}>
                  <strong>{artist.name}</strong>
                </Link>
                <p className="muted" style={{ margin: '.25rem 0 0', fontSize: '.85rem' }}>
                  {artist.publishedSongs === 1 ? '1 song' : `${artist.publishedSongs} songs`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="explore">
        <h2 id="explore" style={{ fontSize: '1.1rem' }}>
          Explore
        </h2>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {SECTIONS.map((section) => (
            <li key={section.href} className="panel">
              <Link href={section.href}>
                <h3 style={{ margin: '0 0 0.35rem' }}>{section.title}</h3>
              </Link>
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                {section.blurb}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: '3rem' }} className="panel">
        <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>New here?</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Drill Lyrics is not a streaming service. Music stays on YouTube; we add lyrics, context and a
          map of the scene. Read <Link href="/about">about how it works</Link>.
        </p>
      </section>
    </main>
  );
}
