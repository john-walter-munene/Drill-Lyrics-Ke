'use client';

import Link from 'next/link';
import type { Song } from '@drillke/shared';
import { usePlayer, type PlayerTrack } from '../components/player/PlayerProvider';

export default function SongList({ songs }: { songs: Song[] }) {
  const { play, track, playbackState } = usePlayer();
  const queue: PlayerTrack[] = songs.map((song) => ({
    slug: song.slug,
    title: song.title,
    artistNames: song.artists.map((artist) => artist.name),
    youtubeVideoId: song.youtubeVideoId,
  }));

  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
      {songs.map((song, index) => {
        const item = queue[index];
        const isCurrent = track?.slug === song.slug;
        const isPlaying = isCurrent && playbackState === 'playing';
        const isBuffering = isCurrent && playbackState === 'buffering';
        return (
          <li key={song.slug} className="panel song-list-item">
            <img
              className="song-list-item__artwork"
              src={`https://i.ytimg.com/vi/${song.youtubeVideoId}/mqdefault.jpg`}
              alt=""
              loading="lazy"
              width="112"
              height="63"
            />
            <div>
              <Link href={`/songs/${song.slug}`}><strong>{song.title}</strong></Link>
              <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                {song.artists.length
                  ? song.artists.map((artist) => artist.name).join(', ')
                  : <span>Artist attribution pending</span>}
                {song.lyrics.versionId ? (
                  <span className="badge" style={{ marginLeft: '0.5rem' }}>
                    {song.lyrics.syncStatus === 'synchronized' ? 'Synced' : 'Lyrics'}
                  </span>
                ) : null}
              </p>
            </div>
            <button type="button" className="btn btn--primary btn--sm" disabled={isPlaying || isBuffering} onClick={() => play(item, queue, true)}>
              {isPlaying ? 'Playing' : isBuffering ? 'Loading…' : '▶ Play'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
