import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * Drop cached catalogue pages after the API changes what is public.
 *
 * The catalogue pages are statically rendered and cached for 2–5 minutes, so an
 * artist imported from YouTube would otherwise be invisible on /songs and their
 * own profile until the window expired. The API calls this at the end of an
 * import that published something.
 *
 *   POST /api/revalidate   { "paths": ["/", "/songs", "/artists", "/artists/<slug>"] }
 *
 * The API is the only caller and it lives inside the compose network (or on
 * localhost in host development), so only paths are accepted — never an
 * arbitrary URL — and a request from an unknown origin is refused.
 */

/** Bounded: catalogue pages only, one optional slug, nothing external. */
const ALLOWED_PREFIX = /^\/(songs|artists|djs|podcasts|events)?(\/[\w-]+)?$/;

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  // Server-to-server calls (fetch from Node) may omit Origin entirely; a
  // browser call always sends one, and must be same-origin.
  if (!origin) return true;
  try {
    const { origin: site } = new URL(request.url);
    return new URL(origin).origin === site;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ ok: false, message: 'Cross-origin revalidation is not allowed' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { paths?: unknown } | null;
  const requested = Array.isArray(body?.paths) ? body.paths : [];
  // Fewer than 20 paths per call: this is a catalogue nudge, not a cache wipe.
  const paths = requested
    .filter((path): path is string => typeof path === 'string')
    .filter((path) => path.startsWith('/') && !path.startsWith('//') && ALLOWED_PREFIX.test(path))
    .slice(0, 20);

  if (!paths.length) {
    return NextResponse.json({ ok: false, message: 'No valid paths' }, { status: 400 });
  }

  for (const path of paths) revalidatePath(path);
  return NextResponse.json({ ok: true, revalidated: paths });
}
