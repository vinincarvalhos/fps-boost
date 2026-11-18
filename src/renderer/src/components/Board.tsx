import type { ReactElement } from 'react'
import type { LiveStats, SystemInfo } from '@shared/types'

/**
 * The dashboard hero: the user's own machine drawn as a circuit board.
 * Every chip is a real component; trace brightness and flow follow live load.
 */

const GOLD = '#C9A44A'
const HOT = '#F0D27A'

function shortCpu(brand: string): string {
  return brand
    .replace(/\(R\)|\(TM\)|CPU|Processor|\d+-Core|with Radeon.*$/gi, '')
    .replace(/@.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function shortGpu(model: string): string {
  return model.replace(/NVIDIA|GeForce|AMD|Radeon\(TM\)|\(R\)|Graphics/gi, '').replace(/\s+/g, ' ').trim() || model
}

function Trace({ d, load }: { d: string; load: number | null }) {
  const l = load == null ? 0.15 : Math.min(1, Math.max(0, load / 100))
  const color = l > 0.7 ? HOT : GOLD
  const dur = l > 0.03 ? `${(2.6 - l * 2.2).toFixed(2)}s` : undefined
  return (
    <g>
      <path d={d} fill="none" stroke={GOLD} strokeOpacity={0.22} strokeWidth={2.5} strokeLinejoin="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeOpacity={0.35 + l * 0.65}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeDasharray="6 10"
        className="trace-flow"
        style={{ animationDuration: dur, animationPlayState: dur ? 'running' : 'paused' }}
      />
    </g>
  )
}

/** Gold pins along the sides of a chip */
function Pins({ x, y, w, h, n }: { x: number; y: number; w: number; h: number; n: number }) {
  const out: ReactElement[] = []
  for (let i = 0; i < n; i++) {
    const px = x + ((i + 1) * w) / (n + 1)
    const py = y + ((i + 1) * h) / (n + 1)
    out.push(
      <rect key={`t${i}`} x={px - 2} y={y - 7} width={4} height={7} fill={GOLD} />,
      <rect key={`b${i}`} x={px - 2} y={y + h} width={4} height={7} fill={GOLD} />,
      <rect key={`l${i}`} x={x - 7} y={py - 2} width={7} height={4} fill={GOLD} />,
      <rect key={`r${i}`} x={x + w} y={py - 2} width={7} height={4} fill={GOLD} />
    )
  }
  return <>{out}</>
}

function Designator({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text x={x} y={y} fill="#EDEFE6" fillOpacity={0.55} fontSize={12} style={{ fontVariationSettings: "'wdth' 100" }}>
      {children}
    </text>
  )
}

export function Board({ info, live }: { info: SystemInfo | null; live: LiveStats | null }) {
  const cpuLoad = live?.cpuLoad ?? null
  const gpu = info?.gpus[0]
  const slots = Math.min(4, Math.max(2, info?.memory.modules.length ?? 2))
  const filled = info?.memory.modules.length ?? 0
  const memPct = live?.memUsedPct ?? 0
  const disks = (info?.disks ?? []).slice(0, 2)

  return (
    <svg viewBox="0 0 1000 450" role="img" aria-label="Esquema do seu computador com uso em tempo real" className="w-full">
      <style>{`
        .trace-flow { animation: flow linear infinite; }
        @keyframes flow { to { stroke-dashoffset: -32; } }
        @media (prefers-reduced-motion: reduce) { .trace-flow { animation: none; } }
      `}</style>

      {/* board outline + mounting holes */}
      <rect x={6} y={6} width={988} height={438} rx={10} fill="none" stroke="#1F6250" strokeWidth={2} />
      {[
        [26, 26],
        [974, 26],
        [26, 424],
        [974, 424]
      ].map(([cx, cy]) => (
        <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={8} fill="#082A21" stroke={GOLD} strokeWidth={3} />
      ))}

      {/* traces — drawn first so chips sit on top */}
      {[0, 1, 2, 3].map((i) => (
        <Trace key={`ram${i}`} d={`M 557 ${150 + i * 14} H 585 L 600 ${135 + i * 14} H 616`} load={memPct} />
      ))}
      {[0, 1, 2].map((i) => (
        <Trace key={`gpu${i}`} d={`M ${400 + i * 40} 337 V 352 L ${390 + i * 40} 362 V 372`} load={live?.gpuLoad ?? cpuLoad} />
      ))}
      {[0, 1].map((i) => (
        <Trace key={`os${i}`} d={`M 323 ${200 + i * 30} H 290 L 275 ${190 + i * 30} H 255`} load={cpuLoad} />
      ))}
      <Trace d="M 557 300 H 690 L 730 340 V 372" load={cpuLoad} />

      {/* U1 — CPU */}
      <Pins x={330} y={110} w={220} h={220} n={9} />
      <rect x={330} y={110} width={220} height={220} rx={3} fill="#082A21" stroke="#1F6250" />
      <rect x={346} y={126} width={188} height={188} rx={2} fill="none" stroke={GOLD} strokeOpacity={0.35} />
      <Designator x={330} y={96}>U1</Designator>
      <text x={358} y={156} fill="#EDEFE6" fontSize={14} fontWeight={600}>
        {info ? shortCpu(info.cpu.brand).slice(0, 22) : 'Processador'}
      </text>
      <text x={358} y={252} fill={cpuLoad != null && cpuLoad > 70 ? HOT : '#EDEFE6'} fontSize={92} className="type-numeric">
        {cpuLoad ?? '—'}
        <tspan fontSize={30} dx={4} fill="#9FB8AB">%</tspan>
      </text>
      <text x={358} y={292} fill="#9FB8AB" fontSize={13}>
        {info ? `${info.cpu.cores} núcleos, ${info.cpu.threads} threads` : ''}
        {live?.cpuTemp != null ? `   ${live.cpuTemp}°C` : ''}
      </text>

      {/* U2 — memory slots */}
      <Designator x={616} y={96}>{`J1–J${slots}`}</Designator>
      {Array.from({ length: slots }, (_, i) => {
        const x = 616 + i * 34
        const has = i < filled || (filled === 0 && i === 0)
        const fillH = has ? (236 * memPct) / 100 : 0
        return (
          <g key={i}>
            <rect x={x} y={104} width={22} height={240} rx={2} fill="#082A21" stroke="#1F6250" />
            {has && <rect x={x + 3} y={104 + 237 - fillH} width={16} height={fillH} fill={GOLD} fillOpacity={0.75} />}
            {has &&
              Array.from({ length: 8 }, (_, k) => (
                <rect key={k} x={x + 5} y={114 + k * 27} width={12} height={16} fill="#16503F" fillOpacity={0.9} />
              ))}
          </g>
        )
      })}
      <text x={616 + slots * 34 + 10} y={240} fill="#EDEFE6" fontSize={58} className="type-numeric">
        {live?.memUsedGb ?? '—'}
      </text>
      <text x={616 + slots * 34 + 12} y={264} fill="#9FB8AB" fontSize={13}>
        de {info?.memory.totalGb ?? '—'} GB em uso
      </text>
      <text x={616 + slots * 34 + 12} y={284} fill="#9FB8AB" fontSize={13}>
        {info?.memory.modules[0] ? `${info.memory.modules[0].type} ${info.memory.modules[0].speedMhz} MHz` : ''}
      </text>

      {/* U3 — operating system */}
      <Designator x={90} y={150}>U3</Designator>
      <rect x={90} y={160} width={165} height={110} rx={3} fill="#082A21" stroke="#1F6250" />
      <text x={104} y={190} fill="#EDEFE6" fontSize={14} fontWeight={600}>
        {info ? info.os.distro.replace(/Microsoft |Single Language|Education|Workstations/g, '').trim().slice(0, 18) : 'Windows'}
      </text>
      <text x={104} y={212} fill="#9FB8AB" fontSize={12}>
        {info ? `build ${info.os.build}` : ''}
      </text>
      <text x={104} y={252} fill="#9FB8AB" fontSize={12}>
        {info?.board.model ? info.board.model.slice(0, 22) : ''}
      </text>

      {/* PCIe — GPU card */}
      <Designator x={330} y={366}>PCIE1</Designator>
      <rect x={380} y={372} width={300} height={52} rx={3} fill="#082A21" stroke="#1F6250" />
      {Array.from({ length: 22 }, (_, k) => (
        <rect key={k} x={390 + k * 13} y={418} width={7} height={6} fill={GOLD} />
      ))}
      <text x={394} y={398} fill="#EDEFE6" fontSize={14} fontWeight={600}>
        {gpu ? shortGpu(gpu.model).slice(0, 26) : 'Placa de vídeo'}
      </text>
      <text x={666} y={404} textAnchor="end" fill="#EDEFE6" fontSize={34} className="type-numeric">
        {live?.gpuLoad != null ? `${live.gpuLoad}%` : gpu ? `${Math.round(gpu.vramMb / 1024)} GB` : ''}
      </text>

      {/* M.2 / SATA storage */}
      {disks.map((d, i) => (
        <g key={d.name + i}>
          <rect x={712} y={372 + i * 28} width={240} height={22} rx={2} fill="#082A21" stroke="#1F6250" />
          <circle cx={944} cy={383 + i * 28} r={4} fill="none" stroke={GOLD} strokeWidth={2} />
          <text x={722} y={388 + i * 28} fill="#9FB8AB" fontSize={11.5}>
            {`${d.type} ${d.sizeGb >= 1000 ? (d.sizeGb / 1000).toFixed(1) + ' TB' : d.sizeGb + ' GB'}  ${d.name}`.slice(0, 31)}
          </text>
        </g>
      ))}
    </svg>
  )
}
