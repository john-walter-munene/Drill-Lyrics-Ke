'use client';

import type { LyricsPayload, Song } from '@drillke/shared';
import { useEffect } from 'react';
import { usePlayer } from '../../components/player/PlayerProvider';
import LyricsView from '../../components/player/LyricsView';

/**
 * Connects a song page to the persistent player: registering the track lets the
 * player keep playing across navigation, and the lyrics render alongside it.
 */
export default function SongPlayerView({
  song,
  lyrics,
}: {
  song: Song;
  lyrics: LyricsPayload | null;
}) {
  const { play } = usePlayer();

  useEffect(() => {
    play({
      slug: song.slug,
      title: song.title,
      artistNames: song.artists.map((a) => a.name),
      youtubeVideoId: song.youtubeVideoId,
    });
  }, [play, song.slug, song.title, song.youtubeVideoId, song.artists]);

  return (
    <div className="player-layout" style={{ marginTop: '1.5rem' }}>
      <div className="panel">
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Playing from YouTube. Use the player above — lyrics follow the music.
        </p>
        {song.releaseDate ? (
          <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.8rem' }}>
            Released {song.releaseDate}
          </p>
        ) : null}
      </div>
      <LyricsView lyrics={lyrics} />
    </div>
  );
}
