import { useId } from 'react'

/** FpsBoost mark: gradient hexagon with two "boost" chevrons. Same artwork as build/icon.svg. */
export function LogoMark({ size = 32 }: { size?: number }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={id} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="0.5" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <polygon
        points="32,5 55.4,18.5 55.4,45.5 32,59 8.6,45.5 8.6,18.5"
        fill={`url(#${id})`}
        stroke={`url(#${id})`}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <polyline points="20,45 32,34 44,45" fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="20,32 32,21 44,32" fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={30} />
      <span className="font-[family-name:var(--font-display)] text-[18px] font-bold tracking-tight">FpsBoost</span>
    </span>
  )
}
