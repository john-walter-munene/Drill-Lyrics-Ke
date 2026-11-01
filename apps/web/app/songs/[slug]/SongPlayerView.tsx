'use client';

import type { LyricsPayload, Song } from '@drillke/shared';
import { useEffect } from 'react';
import { usePlayer, type PlayerTrack } from '../../components/player/PlayerProvider';
import LyricsView from '../../components/player/LyricsView';

/**
 * Connects a song page to the persistent player: registering the track lets the
 * player keep playing across navigation, and the lyrics render alongside it.
 */
export default function SongPlayerView({
  song,
  lyrics,
  queue,
}: {
  song: Song;
  lyrics: LyricsPayload | null;
  queue: PlayerTrack[];
}) {
  const { play, track, playbackMode, playbackState } = usePlayer();

  useEffect(() => {
    // Only take over when the page's song is not already the player's track, or
    // when the player is idle. Re-registering on every visit used to restart the
    // count of a song that was already playing while the reader navigated.
    if (track?.slug === song.slug) return;
    const busy = playbackState === 'playing' || playbackState === 'buffering';
    if (busy && track) return;
    play({
      slug: song.slug,
      title: song.title,
      artistNames: song.artists.map((a) => a.name),
      youtubeVideoId: song.youtubeVideoId,
    }, queue, false);
  }, [play, track, song.slug, song.title, song.youtubeVideoId, song.artists, queue, playbackState]);

  return (
    <div className={`player-layout${playbackMode === 'listen' ? ' player-layout--listen' : ''}`} style={{ marginTop: '1.5rem' }}>
      <div className="panel">
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          {playbackMode === 'listen'
            ? 'Listen mode keeps the YouTube player visible and interactive while giving the lyrics more room.'
            : 'Watch the YouTube video while the lyrics stay alongside it.'}
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
