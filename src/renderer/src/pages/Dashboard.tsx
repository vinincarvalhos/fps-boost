import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, ChevronRight, Crown, Minus } from 'lucide-react'
import type { ActivityEntry, TweakMeta } from '@shared/types'
import { ConfirmTweak } from '../components/ConfirmTweak'
import { PageHeader } from '../components/PageHeader'
import { AreaChart, Donut, Sparkline } from '../components/Sparkline'
import { useLive } from '../lib/live'
import { useAccount, usePremium } from '../lib/account'
import { isPremiumTweak } from '@shared/types'
import { categoryOf, needsConfirm, sortCategories, useTweaks } from '../lib/tweaks'

const C = { cpu: '#3B82F6', gpu: '#A855F7', ram: '#F59E0B', disk: '#22D3EE' }
const CAT_COLORS = ['#3B82F6', '#A855F7', '#22D3EE', '#F59E0B', '#22C55E', '#EC4899']

const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)

/** Current reading vs. the window average, e.g. "↑ 4 pts vs média". Higher load is shown in amber, lower in green. */
function Trend({ values }: { values: number[] }) {
  if (values.length < 5) return <p className="text-[12.5px] text-muted">Coletando leituras…</p>
  const diff = Math.round(values[values.length - 1] - avg(values))
  const Icon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus
  const color = diff > 2 ? 'text-ram' : diff < -2 ? 'text-up' : 'text-muted'
  return (
    <p className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-muted">
      <span className={`flex items-center gap-0.5 whitespace-nowrap font-semibold ${color}`}>
        <Icon size={13} strokeWidth={2.5} />
        {Math.abs(diff)} pts
      </span>
      vs média
    </p>
  )
}

function Kpi({ label, color, value, unit = '%', foot, children }: { label: string; color: string; value: number | null; unit?: string; foot: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label} className="card flex min-w-0 flex-col gap-2 overflow-hidden p-4 pb-0">
      <h2 className="flex items-center gap-2 text-[13.5px] font-medium text-muted">
        <span aria-hidden className="size-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        {label}
      </h2>
      <p className="num text-[30px] font-bold">
        {value ?? '—'}
        {value != null && <span className="ml-0.5 text-[17px] font-semibold text-muted">{unit}</span>}
      </p>
      {foot}
      <div className="-mx-4 mt-1">{children}</div>
    </section>
  )
}

const ACTIVITY = {
  applied: { letter: 'A', bg: 'bg-primary', text: 'Aplicado' },
  reverted: { letter: 'R', bg: 'bg-ram', text: 'Revertido' },
  'restore-point': { letter: 'P', bg: 'bg-up', text: 'Ponto de restauração' },
  cleaned: { letter: 'L', bg: 'bg-disk', text: 'Limpeza' },
  'apps-removed': { letter: 'W', bg: 'bg-gpu', text: 'Apps do Windows' },
  gamemode: { letter: 'J', bg: 'bg-violet', text: 'Modo jogo' }
} as const

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return `há ${Math.floor(s / 86400)} d`
}

export function Dashboard() {
  const { info, current, cpu, gpu, ram } = useLive()
  const { list, states, loading, busy, load, run } = useTweaks()
  const [history, setHistory] = useState<ActivityEntry[]>([])
  const [confirming, setConfirming] = useState<TweakMeta | null>(null)

  useEffect(() => {
    load()
  }, [load])
  // refresh the activity log whenever a tweak changes state
  useEffect(() => {
    window.fps.invoke<ActivityEntry[]>('history:list').then(setHistory)
  }, [states])

  const cats = useMemo(() => {
    const map = new Map<string, { on: number; total: number }>()
    for (const t of list) {
      const c = categoryOf(t)
      const e = map.get(c) ?? { on: 0, total: 0 }
      e.total++
      if (states[t.id]) e.on++
      map.set(c, e)
    }
    return sortCategories([...map.keys()]).map((name, i) => ({ name, color: CAT_COLORS[i % CAT_COLORS.length], ...map.get(name)! }))
  }, [list, states])

  const onCount = list.filter((t) => states[t.id]).length
  const pendingRec = list.filter((t) => t.recommended && !states[t.id])
  const safeRec = pendingRec.filter((t) => !needsConfirm(t))
  const mainGpu = info?.gpus[0]

  const premium = usePremium()
  const openUpsell = useAccount((s) => s.openUpsell)
  const toggle = (t: TweakMeta) => (isPremiumTweak(t) && !premium ? openUpsell() : needsConfirm(t) ? setConfirming(t) : run(t, true))
  const optimize = async () => {
    if (!premium) return openUpsell()
    for (const t of safeRec) await run(t, true)
  }

  return (
    <>
      <PageHeader title="Visão geral" lead={info ? `${info.os.distro.replace('Microsoft ', '')}, build ${info.os.build}` : 'Lendo informações do sistema…'}>
        <span className="inline-flex h-9 items-center rounded-[10px] border border-line bg-card/70 px-3 text-[13px] text-muted">Atualiza a cada 1,5 s</span>
        <button className="btn btn-primary" disabled={loading || safeRec.length === 0 || busy.size > 0} onClick={optimize}>
          {!premium && <Crown size={15} />}
          Otimizar agora{safeRec.length ? ` (${safeRec.length})` : ''}
        </button>
      </PageHeader>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Processador" color={C.cpu} value={current?.cpuLoad ?? null} foot={<Trend values={cpu} />}>
          <Sparkline values={cpu} color={C.cpu} />
        </Kpi>
        <Kpi label="Placa de vídeo" color={C.gpu} value={current?.gpuLoad ?? null} foot={current?.gpuLoad == null ? <p className="text-[12.5px] text-muted">Uso indisponível para esta placa</p> : <Trend values={gpu} />}>
          <Sparkline values={gpu} color={C.gpu} />
        </Kpi>
        <Kpi label="Memória" color={C.ram} value={current?.memUsedPct ?? null} foot={<Trend values={ram} />}>
          <Sparkline values={ram} color={C.ram} />
        </Kpi>
        <Kpi
          label="Disco do sistema"
          color={C.disk}
          value={current?.disk?.usedPct ?? null}
          foot={<p className="text-[12.5px] text-muted">{current?.disk ? `${current.disk.freeGb} GB livres de ${current.disk.totalGb} GB` : 'Lendo disco…'}</p>}
        >
          <div className="flex h-[46px] items-center px-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full" style={{ width: `${current?.disk?.usedPct ?? 0}%`, background: `linear-gradient(90deg, ${C.disk}, #3B82F6)` }} />
            </div>
          </div>
        </Kpi>
      </div>

      {/* Chart + donut */}
      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="perf" className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="perf" className="card-title">
              Desempenho em tempo real
            </h2>
            <div className="flex gap-3 text-[12.5px] text-muted">
              {[
                ['CPU', C.cpu],
                ['GPU', C.gpu],
                ['Memória', C.ram]
              ].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: c }} />
                  {l}
                </span>
              ))}
            </div>
          </div>
          <AreaChart
            height={286}
            series={[
              { label: 'Memória', color: C.ram, values: ram },
              { label: 'GPU', color: C.gpu, values: gpu },
              { label: 'CPU', color: C.cpu, values: cpu }
            ]}
          />
        </section>

        <section aria-labelledby="donut" className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="donut" className="card-title">
              Ajustes ativos
            </h2>
            <Link to="/tweaks" className="btn btn-ghost btn-sm">
              Ver todos
            </Link>
          </div>
          {loading ? (
            <p className="py-10 text-center text-muted">Verificando o Windows…</p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Donut size={136} segments={cats.map((c) => ({ value: c.on, color: c.color }))}>
                <div>
                  <p className="num text-[26px] font-bold">
                    {onCount}
                    <span className="text-[16px] text-muted">/{list.length}</span>
                  </p>
                  <p className="text-[12px] text-muted">ligados</p>
                </div>
              </Donut>
              <ul className="flex w-full flex-col gap-1.5">
                {cats.map((c) => (
                  <li key={c.name}>
                    <Link to={`/tweaks?c=${encodeURIComponent(c.name)}`} className="flex items-center gap-2 text-[13px] hover:text-primary">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: c.color }} />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="num font-semibold">
                        {c.on}/{c.total}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Activity, recommended, hardware */}
      <div className="grid gap-4 xl:grid-cols-3">
        <section aria-labelledby="act" className="card flex flex-col p-5">
          <h2 id="act" className="card-title mb-3">
            Atividade recente
          </h2>
          {history.length === 0 ? (
            <p className="text-muted">Nada por aqui ainda. Ajustes aplicados e pontos de restauração aparecem nesta lista.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {history.slice(0, 5).map((h, i) => {
                const a = ACTIVITY[h.kind]
                return (
                  <li key={h.at + i} className="flex items-center gap-3 rounded-[10px] px-1 py-1.5">
                    <span className={`grid size-7 shrink-0 place-items-center rounded-[8px] text-[12px] font-bold text-white ${a.bg}`}>{a.letter}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{h.title}</p>
                      <p className="text-[12px] text-muted">{a.text}</p>
                    </div>
                    <span className="shrink-0 text-[12px] text-muted">{ago(h.at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <Link to="/backup" className="btn btn-ghost btn-sm mt-auto self-end">
            Backup <ChevronRight size={14} />
          </Link>
        </section>

        <section aria-labelledby="rec" className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="rec" className="card-title">
              Recomendados
            </h2>
            <span className="tag">{pendingRec.length} pendentes</span>
          </div>
          {loading ? (
            <p className="text-muted">Verificando…</p>
          ) : pendingRec.length === 0 ? (
            <p className="text-muted">Todos os ajustes recomendados estão ligados.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {pendingRec.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => toggle(t)}
                    disabled={busy.has(t.id)}
                    className="group flex w-full items-center gap-3 rounded-[10px] border border-line bg-bg/40 px-3 py-2 text-left hover:border-primary/60 disabled:cursor-wait"
                  >
                    <span className={`grid size-5 shrink-0 place-items-center rounded-[6px] border-2 ${busy.has(t.id) ? 'animate-pulse border-primary' : 'border-muted/60 group-hover:border-primary'}`}>
                      <Check size={12} strokeWidth={3} className="text-primary opacity-0 group-hover:opacity-100" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="hw" className="card p-5">
          <h2 id="hw" className="card-title mb-3">
            Seu hardware
          </h2>
          {info ? (
            <dl className="flex flex-col gap-2.5">
              {[
                ['Processador', info.cpu.brand.replace(/ with Radeon Graphics/i, ''), `${info.cpu.cores} núcleos, ${info.cpu.threads} threads`, C.cpu],
                ['Placa de vídeo', mainGpu?.model ?? '—', mainGpu ? `${Math.round(mainGpu.vramMb / 1024)} GB${mainGpu.driver ? `, driver ${mainGpu.driver}` : ''}` : '', C.gpu],
                ['Memória', `${info.memory.totalGb} GB`, info.memory.modules[0] ? `${info.memory.modules[0].type} ${info.memory.modules[0].speedMhz} MHz` : '', C.ram],
                ['Armazenamento', info.disks[0]?.name ?? '—', info.disks[0] ? `${info.disks[0].type}, ${info.disks[0].sizeGb >= 1000 ? (info.disks[0].sizeGb / 1000).toFixed(1) + ' TB' : info.disks[0].sizeGb + ' GB'}` : '', C.disk]
              ].map(([label, value, sub, color]) => (
                <div key={label} className="flex items-start gap-3">
                  <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: color }} />
                  <div className="min-w-0">
                    <dt className="text-[12px] text-muted">{label}</dt>
                    <dd className="truncate font-medium">{value}</dd>
                    {sub && <dd className="truncate text-[12px] text-muted">{sub}</dd>}
                  </div>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted">Lendo componentes…</p>
          )}
        </section>
      </div>

      {confirming && <ConfirmTweak tweak={confirming} onClose={() => setConfirming(null)} />}
    </>
  )
}
