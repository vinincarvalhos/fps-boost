

const WINDOW = 60 // readings shown; the trace scrolls instead of stretching

function points(values: number[], w: number, h: number, pad = 2): string[] {
  const step = w / (WINDOW - 1)
  const offset = (WINDOW - values.length) * step
  return values.map((v, i) => `${(offset + i * step).toFixed(1)},${(h - pad - (Math.min(100, Math.max(0, v)) / 100) * (h - pad * 2)).toFixed(1)}`)
}

/** Small area trace for KPI cards, 0–100 scale. */
export function Sparkline({ values, color, height = 46 }: { values: number[]; color: string; height?: number }) {
  const W = 200
  if (values.length < 2) return <div style={{ height }} />
  const pts = points(values, W, height)
  const first = pts[0].split(',')[0]
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden>
      {/* flat translucent fill: no decorative gradients */}
      <polygon points={`${first},${height} ${pts.join(' ')} ${W},${height}`} fill={color} fillOpacity={0.1} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export interface Series {
  label: string
  color: string
  values: number[]
}

/** Larger multi-series chart with a % axis and a time axis. */
export function AreaChart({ series, height = 220 }: { series: Series[]; height?: number }) {
  const W = 600
  const ticks = [100, 75, 50, 25, 0]
  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between pb-6 text-right text-[12px] text-muted" style={{ height }}>
        {ticks.map((t) => (
          <span key={t} className="num leading-none">
            {t}%
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <svg viewBox={`0 0 ${W} ${height - 24}`} preserveAspectRatio="none" className="block w-full" style={{ height: height - 24 }} role="img" aria-label="Uso de CPU, GPU e memória nos últimos 90 segundos">
          {ticks.map((t) => {
            const y = ((100 - t) / 100) * (height - 24 - 4) + 2
            return <line key={t} x1={0} x2={W} y1={y} y2={y} style={{ stroke: 'var(--color-grid)' }} strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          })}
          {series.map((s) => {
            if (s.values.length < 2) return null
            const pts = points(s.values, W, height - 24)
            const first = pts[0].split(',')[0]
            return (
              <g key={s.label}>
                <polygon points={`${first},${height - 24} ${pts.join(' ')} ${W},${height - 24}`} fill={s.color} fillOpacity={0.06} />
                <polyline points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={2.25} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex justify-between text-[12px] text-muted">
          <span>90 s atrás</span>
          <span>60 s</span>
          <span>30 s</span>
          <span>agora</span>
        </div>
      </div>
    </div>
  )
}

/** Donut with a centred label. Segments are drawn in order, starting at 12 o'clock. */
export function Donut({ segments, size = 150, children }: { segments: { value: number; color: string }[]; size?: number; children?: React.ReactNode }) {
  const r = 52
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0)
  let acc = 0
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 140 140" width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={70} cy={70} r={r} fill="none" style={{ stroke: 'var(--color-grid)' }} strokeWidth={16} />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * c
            const gap = segments.filter((x) => x.value > 0).length > 1 ? 3 : 0
            const el = (
              <circle
                key={i}
                cx={70}
                cy={70}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={16}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-acc}
              />
            )
            acc += len
            return el
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}
