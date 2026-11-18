/**
 * FpsBoost mark: an app-icon squircle in Action Blue with a two-chevron "boost" glyph.
 * Same artwork as build/icon.svg. Flat, as DESIGN.md asks: no gradients, no shadow.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect x={2} y={2} width={60} height={60} rx={14} ry={14} fill="#0066cc" />
      <polyline points="21,42 32,32 43,42" fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="21,30 32,20 43,30" fill="none" stroke="#fff" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Mark + wordmark. The wordmark inherits the surrounding text colour. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-[15px] font-semibold tracking-[-0.022em]">FpsBoost</span>
    </span>
  )
}
