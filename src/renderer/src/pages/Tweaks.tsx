import { useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDown, RotateCcw, Search } from 'lucide-react'
import type { TweakMeta, TweakResult } from '@shared/types'
import { DipSwitch } from '../components/DipSwitch'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { toast } from '../lib/toast'

type Filter = 'all' | 'recommended' | 'on' | 'off'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'recommended', label: 'Recomendados' },
  { id: 'on', label: 'Ligados' },
  { id: 'off', label: 'Desligados' }
]

/** Category order on the page; anything else goes at the end alphabetically. */
const CATEGORY_ORDER = ['Desempenho', 'Jogos', 'Rede', 'Privacidade', 'Interface', 'Sistema']

function TweakRow({
  tweak,
  on,
  busy,
  onToggle
}: {
  tweak: TweakMeta
  on: boolean
  busy: boolean
  onToggle: () => void
}) {
  const [open, setOpen] = useState(false)
  const lockedOn = on && !tweak.reversible
  return (
    <li className="border-b border-mask-line/70 last:border-b-0">
      <div className="flex items-start gap-5 py-4">
        <DipSwitch on={on} busy={busy} disabled={lockedOn} label={tweak.title} onToggle={onToggle} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-semibold" style={{ fontVariationSettings: "'wdth' 108" }}>
              {tweak.title}
            </h3>
            {tweak.recommended && <span className="text-[13px] text-gold">recomendado</span>}
            {tweak.risk === 'caution' && <span className="text-[13px] text-flux">exige atenção</span>}
            {tweak.restart && <span className="text-[13px] text-silk-dim">pede reinício</span>}
            {!tweak.reversible && <span className="text-[13px] text-silk-dim">sem reversão automática</span>}
          </div>
          <p className="mt-1 max-w-[70ch] text-[14px] text-silk-dim">{tweak.description}</p>
          {open && tweak.details && (
            <div className="prose-silk mt-3 max-w-[70ch] border-l-2 border-gold/40 pl-4 text-[14px] text-silk-dim">
              <Markdown remarkPlugins={[remarkGfm]}>{tweak.details}</Markdown>
            </div>
          )}
        </div>
        {tweak.details && (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-0.5 flex items-center gap-1 text-[13px] text-silk-dim hover:text-silk"
          >
            {open ? 'Menos' : 'Detalhes'}
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
    </li>
  )
}

export function Tweaks() {
  const [tweaks, setTweaks] = useState<TweakMeta[]>([])
  const [states, setStates] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [confirming, setConfirming] = useState<TweakMeta | null>(null)
  const [needsRestart, setNeedsRestart] = useState(false)

  useEffect(() => {
    Promise.all([
      window.fps.invoke<TweakMeta[]>('tweaks:list'),
      window.fps.invoke<Record<string, boolean>>('tweaks:states')
    ])
      .then(([list, st]) => {
        setTweaks(list)
        setStates(st)
      })
      .finally(() => setLoading(false))
  }, [])

  const run = async (t: TweakMeta, apply: boolean) => {
    setBusy((b) => new Set(b).add(t.id))
    try {
      const res = await window.fps.invoke<TweakResult>(apply ? 'tweaks:apply' : 'tweaks:unapply', t.id)
      if (res.ok) {
        setStates((s) => ({ ...s, [t.id]: apply }))
        toast.ok(apply ? `${t.title}: aplicado` : `${t.title}: revertido`)
        if (t.restart) setNeedsRestart(true)
      } else {
        toast.error(`${t.title} não foi ${apply ? 'aplicado' : 'revertido'}.\n${res.error ?? ''}`.trim())
      }
    } finally {
      setBusy((b) => {
        const n = new Set(b)
        n.delete(t.id)
        return n
      })
    }
  }

  const toggle = (t: TweakMeta) => {
    const on = states[t.id]
    if (!on && (t.confirm || t.risk === 'caution' || !t.reversible)) setConfirming(t)
    else run(t, !on)
  }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const visible = tweaks.filter((t) => {
      if (q && !`${t.title} ${t.description}`.toLowerCase().includes(q)) return false
      if (filter === 'recommended') return t.recommended
      if (filter === 'on') return states[t.id]
      if (filter === 'off') return !states[t.id]
      return true
    })
    const map = new Map<string, TweakMeta[]>()
    for (const t of visible) {
      const cat = t.category[0] ?? 'Sistema'
      map.set(cat, [...(map.get(cat) ?? []), t])
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a)
      const ib = CATEGORY_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
    })
  }, [tweaks, states, query, filter])

  const recommendedOff = tweaks.filter((t) => t.recommended && !states[t.id] && t.risk === 'safe')
  const applyRecommended = async () => {
    for (const t of recommendedOff) await run(t, true)
  }

  const onCount = Object.values(states).filter(Boolean).length

  return (
    <>
      <PageHeader
        title="Ajustes"
        lead={
          loading
            ? 'Lendo o estado atual do Windows…'
            : `${onCount} de ${tweaks.length} ligados. Passe pelos detalhes de cada um antes de ligar: alguns trocam conforto por desempenho.`
        }
      >
        <button className="btn btn-gold" disabled={loading || recommendedOff.length === 0 || busy.size > 0} onClick={applyRecommended}>
          Aplicar recomendados{recommendedOff.length ? ` (${recommendedOff.length})` : ''}
        </button>
      </PageHeader>

      {needsRestart && (
        <div className="mb-8 flex items-center justify-between gap-4 rounded-chip border border-gold/50 px-5 py-3">
          <p className="text-[14px]">Alguns ajustes só valem depois de reiniciar o computador.</p>
          <button className="btn btn-line" onClick={() => window.fps.invoke('app:reboot')}>
            <RotateCcw size={15} /> Reiniciar agora
          </button>
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <label className="relative">
          <span className="sr-only">Buscar ajuste</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-silk-dim" />
          <input
            className="field w-72 pl-9"
            placeholder="Buscar ajuste"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div role="radiogroup" aria-label="Filtrar" className="flex rounded-chip border border-mask-line p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-[2px] px-3 py-1.5 text-[14px] ${
                filter === f.id ? 'bg-mask-raised text-silk' : 'text-silk-dim hover:text-silk'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && groups.length === 0 && (
        <p className="text-silk-dim">Nenhum ajuste corresponde a essa busca. Limpe o campo ou troque o filtro.</p>
      )}

      <div className="flex flex-col gap-12">
        {groups.map(([cat, list]) => (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="type-heading mb-2 text-[26px]">
              {cat}
            </h2>
            <ul>
              {list.map((t) => (
                <TweakRow key={t.id} tweak={t} on={!!states[t.id]} busy={busy.has(t.id)} onToggle={() => toggle(t)} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {confirming && (
        <Modal
          title={confirming.title}
          onClose={() => setConfirming(null)}
          actions={
            <>
              <button className="btn btn-line" onClick={() => setConfirming(null)}>
                Cancelar
              </button>
              <button
                className={confirming.risk === 'caution' ? 'btn btn-flux' : 'btn btn-gold'}
                onClick={() => {
                  const t = confirming
                  setConfirming(null)
                  run(t, true)
                }}
              >
                Aplicar
              </button>
            </>
          }
        >
          <Markdown remarkPlugins={[remarkGfm]}>{confirming.confirm ?? confirming.description}</Markdown>
          {!confirming.reversible && (
            <p>
              <strong>Este ajuste não tem reversão automática.</strong> Para desfazer, use um ponto de restauração na tela
              Backup.
            </p>
          )}
        </Modal>
      )}
    </>
  )
}
