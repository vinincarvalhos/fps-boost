import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDown, Crown, RotateCcw, Search } from 'lucide-react'
import { isPremiumTweak } from '@shared/types'
import { useAccount, usePremium } from '../lib/account'
import type { TweakMeta } from '@shared/types'
import { ConfirmTweak } from '../components/ConfirmTweak'
import { PageHeader } from '../components/PageHeader'
import { Toggle } from '../components/Toggle'
import { AdminNotice } from '../components/Shell'
import { categoryOf, needsConfirm, sortCategories, useTweaks } from '../lib/tweaks'

type Filter = 'all' | 'recommended' | 'on' | 'off'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'recommended', label: 'Recomendados' },
  { id: 'on', label: 'Ligados' },
  { id: 'off', label: 'Desligados' }
]

const HW = {
  cpu: { label: 'CPU', color: '#0066cc' },
  gpu: { label: 'GPU', color: '#af52de' }
} as const

function TweakRow({ tweak, on, busy, onToggle }: { tweak: TweakMeta; on: boolean; busy: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false)
  const hw = tweak.hardware === 'cpu' || tweak.hardware === 'gpu' ? HW[tweak.hardware] : null
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-4 px-4 py-3">
        <Toggle on={on} busy={busy} disabled={on && !tweak.reversible} label={tweak.title} onToggle={onToggle} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="mr-1 font-medium">{tweak.title}</h3>
            {tweak.recommended && <span className="tag text-ink">Recomendado</span>}
            {isPremiumTweak(tweak) && (
              <span className="tag bg-ink text-card">
                <Crown size={11} /> Premium
              </span>
            )}
            {tweak.risk === 'caution' && <span className="tag text-danger">Exige atenção</span>}
            {tweak.restart && <span className="tag">Pede reinício</span>}
            {!tweak.reversible && <span className="tag">Sem reversão</span>}
            {hw && (
              <span className="tag">
                <span aria-hidden className="size-1.5 rounded-full" style={{ background: hw.color }} />
                {hw.label}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">{tweak.description}</p>
        </div>
        {tweak.details && (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? 'Ocultar detalhes' : 'Mostrar detalhes'}
            className="grid size-7 shrink-0 place-items-center rounded-[8px] text-muted hover:bg-card-2 hover:text-ink"
          >
            <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {open && tweak.details && (
        <div className="prose-ui mx-4 mb-3 ml-[66px] rounded-[8px] bg-bg px-4 py-3 text-[13px] text-muted">
          <Markdown remarkPlugins={[remarkGfm]}>{tweak.details}</Markdown>
        </div>
      )}
    </li>
  )
}

export function Tweaks() {
  const { list, states, loading, busy, needsRestart, load, run } = useTweaks()
  const [params, setParams] = useSearchParams()
  const category = params.get('c') ?? 'all'
  const [query, setQuery] = useState(params.get('q') ?? '')
  // the top-bar search navigates here with ?q=
  useEffect(() => {
    const q = params.get('q')
    if (q != null) setQuery(q)
  }, [params])
  const [filter, setFilter] = useState<Filter>('all')
  const [confirming, setConfirming] = useState<TweakMeta | null>(null)

  useEffect(() => {
    load()
  }, [load])

  const categories = useMemo(() => {
    const counts = new Map<string, { on: number; total: number }>()
    for (const t of list) {
      const c = categoryOf(t)
      const e = counts.get(c) ?? { on: 0, total: 0 }
      e.total++
      if (states[t.id]) e.on++
      counts.set(c, e)
    }
    return sortCategories([...counts.keys()]).map((c) => ({ id: c, ...counts.get(c)! }))
  }, [list, states])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((t) => {
      if (category !== 'all' && categoryOf(t) !== category) return false
      if (q && !`${t.title} ${t.description}`.toLowerCase().includes(q)) return false
      if (filter === 'recommended') return t.recommended
      if (filter === 'on') return states[t.id]
      if (filter === 'off') return !states[t.id]
      return true
    })
  }, [list, states, category, query, filter])

  const premium = usePremium()
  const openUpsell = useAccount((s) => s.openUpsell)
  const toggle = (t: TweakMeta) => {
    // reverting stays free so nobody is stuck with a premium tweak applied
    if (!states[t.id] && isPremiumTweak(t) && !premium) openUpsell()
    else if (!states[t.id] && needsConfirm(t)) setConfirming(t)
    else run(t, !states[t.id])
  }

  const safeRec = list.filter((t) => t.recommended && !states[t.id] && !needsConfirm(t))
  const onCount = list.filter((t) => states[t.id]).length
  const setCategory = (c: string) => setParams(c === 'all' ? {} : { c })

  return (
    <>
      <PageHeader
        title="Ajustes"
        lead={loading ? 'Verificando o estado atual do Windows…' : `${onCount} de ${list.length} ligados. Abra os detalhes de um ajuste para ver exatamente o que ele muda.`}
      >
        <button
          className="btn btn-primary"
          disabled={loading || safeRec.length === 0 || busy.size > 0}
          onClick={async () => {
            if (!premium) return openUpsell()
            for (const t of safeRec) await run(t, true)
          }}
        >
          {!premium && <Crown size={15} />}
          Aplicar recomendados{safeRec.length ? ` (${safeRec.length})` : ''}
        </button>
      </PageHeader>

      <AdminNotice />

      {needsRestart && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-[14px] border border-primary/40 bg-primary/10 px-4 py-2.5">
          <p>Alguns ajustes só valem depois de reiniciar o computador.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => window.fps.invoke('app:reboot')}>
            <RotateCcw size={14} /> Reiniciar agora
          </button>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Categories */}
        <nav aria-label="Categorias" className="card p-2 lg:sticky lg:top-0">
          {[{ id: 'all', on: onCount, total: list.length }, ...categories].map((c) => (
            <button
              key={c.id}
              aria-current={category === c.id ? 'true' : undefined}
              onClick={() => setCategory(c.id)}
              className={`flex h-9 w-full items-center justify-between rounded-[10px] px-3 text-left ${
                category === c.id ? 'bg-card-2 font-semibold text-ink' : 'text-ink/80 hover:bg-card-2/60'
              }`}
            >
              {c.id === 'all' ? 'Todas' : c.id}
              <span className="num text-[14px] text-muted">
                {c.on}/{c.total}
              </span>
            </button>
          ))}
        </nav>

        <div className="card min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-2.5">
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Buscar ajuste</span>
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="field w-full pl-8" placeholder="Buscar ajuste" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div role="radiogroup" aria-label="Filtrar" className="flex h-[34px] rounded-[8px] border border-line p-0.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  role="radio"
                  aria-checked={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-[4px] px-2.5 text-[13px] ${filter === f.id ? 'bg-card-2 text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="px-4 py-8 text-muted">Verificando o estado atual do Windows…</p>
          ) : visible.length === 0 ? (
            <div className="px-4 py-8">
              <p className="text-muted">Nenhum ajuste corresponde a essa busca e filtro.</p>
              <button
                className="btn btn-ghost btn-sm mt-3"
                onClick={() => {
                  setQuery('')
                  setFilter('all')
                  setCategory('all')
                }}
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            sortCategories([...new Set(visible.map(categoryOf))]).map((cat) => (
              <section key={cat} aria-label={cat}>
                {category === 'all' && (
                  <h2 className="border-b border-line bg-bg px-4 py-1.5 text-[13px] font-medium text-muted">{cat}</h2>
                )}
                <ul className="border-b border-line last:border-b-0 [&>li:last-child]:border-b-0">
                  {visible
                    .filter((t) => categoryOf(t) === cat)
                    .map((t) => (
                      <TweakRow key={t.id} tweak={t} on={!!states[t.id]} busy={busy.has(t.id)} onToggle={() => toggle(t)} />
                    ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>

      {confirming && <ConfirmTweak tweak={confirming} onClose={() => setConfirming(null)} />}
    </>
  )
}
