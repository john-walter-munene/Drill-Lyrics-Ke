/**
 * The AppKINGS crown, redrawn as vector art from the supplied logo.
 *
 * It is a component rather than an <img> so the mark inherits `currentColor`
 * and stays crisp at every size — the header renders it at 1.75rem, the app
 * icon at 512px.
 *
 * The shape is a three-peak crown on a solid band, with a floating diamond
 * above the centre peak. The peaks are drawn as one filled outline rather than
 * as crossing strokes: two zig-zags over each other read as a "W", which is
 * exactly what the first attempt looked like at header size.
 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      role="img"
      aria-label="AppKINGS crown"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      {/* Floating diamond above the centre peak. */}
      <path d="M50 2 58 14 50 26 42 14Z" />

      {/* Crown: three peaks, a notched valley between each, on a solid band. */}
      <path d="M6 30 22 62 34 40 50 70 66 40 78 62 94 30 88 84 12 84Z" />

      {/* The band's inner cut, so the crown reads as an outline at small sizes. */}
      <path d="M18 72h64v4H18z" fill="var(--bg, #0c0b0a)" />
    </svg>
  );
}
