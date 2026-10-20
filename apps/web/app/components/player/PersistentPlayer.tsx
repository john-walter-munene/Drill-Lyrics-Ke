'use client';

import { usePlayer } from './PlayerProvider';
import PlayerSurface from './PlayerSurface';

/**
 * The persistent player. Mounted once in the root layout, so navigating between
 * songs never unmounts the video element (docs/product.md §5.1).
 */
export default function PersistentPlayer() {
  const { track } = usePlayer();
  return (
    <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>
      <PlayerSurface track={track} />
    </div>
  );
}
