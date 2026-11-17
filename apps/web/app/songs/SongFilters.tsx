import Link from 'next/link';
import {
  catalogueSearchParams,
  type CatalogueParams,
  DEFAULT_SONG_SORT,
  SONG_SORTS,
  type SongSort,
} from '@drillke/shared';

/**
 * The catalogue filter bar.
 *
 * Rendered on the server as **plain links**, not inputs: `?sync=synced` should
 * be shareable, crawlable and correct on the back button, and that is what an
 * anchor gives for free. The only form on the page is the search box, which
 * carries the current filters forward as hidden fields.
 *
 * Search params are echoed so a filter change never silently drops an artist
 * scope or a search term.
 */

const SORT_LABELS: Record<SongSort, string> = {
  newest: 'Newest',
  title: 'Title',
  artist: 'Artist',
  'recently-synced': 'Recently synced',
};

export interface SongFiltersProps {
  /** The page the bar is rendered on, e.g. `/songs` or `/artists/foo`. */
  basePath: string;
  /** The committed query, as parsed by the API's own contract. */
  query: { q?: string; sync?: 'synced' | 'unsynced'; sort: SongSort };
  /** Result count, announced when it changes. */
  total: number;
}

function href(basePath: string, params: CatalogueParams): string {
  const qs = catalogueSearchParams(params);
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * `undefined` means "no filter"; a filter value is the one in the URL. The
 * active pill is `aria-current="true"`, which is also what a screen reader
 * announces as the current item.
 */
function Pills({ label, links, active }: {
  label: string;
  links: { key: string; label: string; href: string }[];
  active: string;
}) {
  return (
    <div className="song-filters__group" role="group" aria-label={label}>
      <span className="song-filters__label">{label}</span>
      {links.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          className={`song-filters__pill${link.key === active ? ' song-filters__pill--active' : ''}`}
          aria-current={link.key === active ? 'true' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export default function SongFilters({ basePath, query, total }: SongFiltersProps) {
  const syncPills = [
    { key: 'all', label: 'All', href: href(basePath, { q: query.q, sort: query.sort }) },
    { key: 'synced', label: 'Synchronized', href: href(basePath, { q: query.q, sort: query.sort, sync: 'synced' }) },
    { key: 'unsynced', label: 'Not yet', href: href(basePath, { q: query.q, sort: query.sort, sync: 'unsynced' }) },
  ];
  const sortPills = SONG_SORTS.map((sort) => ({
    key: sort,
    label: SORT_LABELS[sort],
    href: href(basePath, {
      q: query.q,
      sync: query.sync,
      // The default sort stays off the URL: `/songs` and `/songs?sort=newest`
      // would otherwise be two pages with identical content.
      sort: sort === DEFAULT_SONG_SORT ? undefined : sort,
    }),
  }));

  return (
    <nav className="song-filters" aria-label="Catalogue filters">
      <Pills label="Show" links={syncPills} active={query.sync ?? 'all'} />
      <Pills label="Sort" links={sortPills} active={query.sort} />
      <p className="song-filters__count muted" aria-live="polite" aria-atomic="true">
        {total === 1 ? '1 song' : `${total} songs`}
        {query.sync === 'synced' ? ' with synchronized lyrics' : ''}
        {query.sync === 'unsynced' ? ' waiting for timing' : ''}
      </p>
    </nav>
  );
}