import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, FolderOpen, Play, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import type { Game, GameSettings, GameSource, OpResult } from '@shared/types'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { Toggle } from '../components/Toggle'
import { toast } from '../lib/toast'

const SOURCES: Record<GameSource, { label: string; color: string }> = {
  steam: { label: 'Steam', color: '#66C0F4' },
  epic: { label: 'Epic', color: '#E8ECF8' },
  gog: { label: 'GOG', color: '#B57BF3' },
  ubisoft: { label: 'Ubisoft', color: '#3B82F6' },
  manual: { label: 'Adicionado', color: '#8A94B8' }
}

const SETTINGS: { key: keyof GameSettings; title: string; text: string }[] = [
  { key: 'highPriority', title: 'Prioridade alta de CPU', text: 'O Windows dá prioridade ao jogo sempre que ele abrir, sem precisar do Modo jogo.' },
  { key: 'gpuHigh', title: 'Usar a placa de vídeo dedicada', text: 'Força a GPU de alto desempenho. Essencial em notebooks com vídeo integrado.' },
  { key: 'noFso', title: 'Desativar otimizações de tela cheia', text: 'Usa tela cheia exclusiva de verdade neste jogo. Pode reduzir a latência.' }
]

const cover = (id: number) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`
const header = (id: number) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`

/** Portrait cover, falling back to the wide header and then to the game's initials. */
function Cover({ game, className = '' }: { game: Game; className?: string }) {
  const [stage, setStage] = useState(0)
  useEffect(() => setStage(0), [game.coverAppId])
  const id = game.coverAppId
  if (!id || stage > 1)
    return (
      <div className={`grid place-items-center bg-gradient-to-br from-card-2 via-[#1d2a5c] to-[#2a1d5c] ${className}`}>
        <span className="font-[family-name:var(--font-display)] text-[34px] font-bold text-white/70">
          {game.name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0])
            .join('')
            .toUpperCase()}
        </span>
      </div>
    )
  return <img src={stage === 0 ? cover(id) : header(id)} alt="" loading="lazy" onError={() => setStage((s) => s + 1)} className={`object-cover ${className}`} />
}

function GameDetail({ game, onClose, onChange }: { game: Game; onClose: () => void; onChange: (g: Game | null) => void }) {
  const [exes, setExes] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    window.fps.invoke<string[]>('games:exe-candidates', game.id).then((list) => setExes(game.exe && !list.includes(game.exe) ? [game.exe, ...list] : list))
  }, [game.id, game.exe])

  const update = async (patch: { exe?: string; hidden?: boolean }) => {
    const r = await window.fps.invoke<OpResult & { game?: Game }>('games:update', game.id, patch)
    if (r.game) onChange(r.game)
    else toast.error(r.error ?? 'Não foi possível salvar.')
  }

  const setSetting = async (key: keyof GameSettings) => {
    setBusy(key)
    const r = await window.fps.invoke<OpResult & { game?: Game }>('games:setting', game.id, key, !game.settings[key])
    setBusy(null)
    if (r.game) onChange(r.game)
    else toast.error(r.error ?? 'Não foi possível aplicar.')
  }

  const launch = async () => {
    const r = await window.fps.invoke<OpResult>('games:launch', game.id)
    if (r.ok) toast.ok(`Abrindo ${game.name}…`)
    else toast.error(r.error ?? 'Não foi possível abrir o jogo.')
  }

  return (
    <Modal
      wide
      title={game.name}
      onClose={onClose}
      actions={
        <>
          {game.source === 'manual' ? (
            <button
              className="btn btn-danger mr-auto"
              onClick={async () => {
                await window.fps.invoke('games:remove', game.id)
                onChange(null)
              }}
            >
              <Trash2 size={15} /> Remover da biblioteca
            </button>
          ) : (
            <button className="btn btn-ghost mr-auto" onClick={() => update({ hidden: !game.hidden })}>
              {game.hidden ? <Eye size={15} /> : <EyeOff size={15} />} {game.hidden ? 'Mostrar' : 'Ocultar'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => window.fps.invoke('games:open-folder', game.id)}>
            <FolderOpen size={15} /> Abrir pasta
          </button>
          <button className="btn btn-primary" onClick={launch}>
            <Play size={15} /> Jogar
          </button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
        <Cover game={game} className="aspect-[2/3] w-full rounded-[10px]" />
        <div className="min-w-0 text-ink">
          <p className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span className="tag" style={{ color: SOURCES[game.source].color }}>
              {SOURCES[game.source].label}
            </span>
            {game.sizeGb ? <span>{game.sizeGb.toLocaleString('pt-BR')} GB</span> : null}
            <span className="truncate" title={game.installDir}>
              {game.installDir}
            </span>
          </p>

          <label htmlFor="exe" className="mb-1 block text-[13px] font-medium">
            Executável do jogo
          </label>
          <select
            id="exe"
            className="field mb-4 w-full"
            value={game.exe ?? ''}
            onChange={(e) => e.target.value && update({ exe: e.target.value })}
          >
            {!game.exe && <option value="">Escolha o executável</option>}
            {exes.map((x) => (
              <option key={x} value={x}>
                {x.slice(game.installDir.length).replace(/^\\/, '') || x}
              </option>
            ))}
          </select>

          <ul className="flex flex-col divide-y divide-line rounded-[10px] border border-line">
            {SETTINGS.map((s) => (
              <li key={s.key} className="flex items-center gap-4 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-[12.5px] text-muted">{s.text}</p>
                </div>
                <Toggle label={s.title} on={game.settings[s.key]} busy={busy === s.key} disabled={!game.exe} onToggle={() => setSetting(s.key)} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  )
}

export function Games() {
  const [list, setList] = useState<Game[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [q, setQ] = useState('')
  const [source, setSource] = useState<GameSource | 'all'>('all')
  const [showHidden, setShowHidden] = useState(false)
  const [open, setOpen] = useState<Game | null>(null)

  const scan = async () => {
    setScanning(true)
    try {
      setList(await window.fps.invoke<Game[]>('games:scan'))
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    window.fps.invoke<Game[]>('games:list').then((g) => {
      setList(g)
      if (g.length === 0) scan()
    })
  }, [])

  const visible = useMemo(
    () =>
      (list ?? []).filter(
        (g) => (showHidden || !g.hidden) && (source === 'all' || g.source === source) && (!q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase()))
      ),
    [list, showHidden, source, q]
  )
  const counts = useMemo(() => {
    const c: Partial<Record<GameSource, number>> = {}
    for (const g of list ?? []) if (!g.hidden) c[g.source] = (c[g.source] ?? 0) + 1
    return c
  }, [list])

  const add = async () => {
    const r = await window.fps.invoke<OpResult & { game?: Game }>('games:add')
    if (r.game) {
      toast.ok(`${r.game.name} adicionado`)
      setList(await window.fps.invoke<Game[]>('games:list'))
      setOpen(r.game)
    } else if (r.error) toast.error(r.error)
  }

  const replace = (g: Game | null, id: string) => {
    setList((l) => (l ?? []).flatMap((x) => (x.id === id ? (g ? [g] : []) : [x])))
    setOpen(g)
  }

  const total = (list ?? []).filter((g) => !g.hidden).length

  return (
    <>
      <PageHeader
        title="Biblioteca"
        lead={scanning ? 'Procurando jogos na Steam, Epic, GOG e Ubisoft…' : `${total} ${total === 1 ? 'jogo' : 'jogos'} encontrados neste PC.`}
      >
        <button className="btn btn-ghost" disabled={scanning} onClick={scan}>
          <RefreshCw size={15} className={scanning ? 'animate-spin' : ''} /> Procurar jogos
        </button>
        <button className="btn btn-primary" onClick={add}>
          <Plus size={15} /> Adicionar jogo
        </button>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <label className="relative w-[260px]">
          <span className="sr-only">Buscar jogo</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field w-full pl-9" placeholder="Buscar jogo" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div role="radiogroup" aria-label="Loja" className="flex flex-wrap gap-1.5">
          {(['all', ...(Object.keys(SOURCES) as GameSource[]).filter((s) => counts[s])] as (GameSource | 'all')[]).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={source === s}
              onClick={() => setSource(s)}
              className={`h-9 rounded-full border px-3.5 text-[13px] font-medium ${
                source === s ? 'border-primary bg-primary/15 text-ink' : 'border-line text-muted hover:text-ink'
              }`}
            >
              {s === 'all' ? `Todos (${total})` : `${SOURCES[s].label} (${counts[s]})`}
            </button>
          ))}
        </div>
        <button className="ml-auto flex items-center gap-2 text-[13px] text-muted hover:text-ink" onClick={() => setShowHidden((v) => !v)}>
          {showHidden ? <EyeOff size={15} /> : <Eye size={15} />} {showHidden ? 'Esconder ocultos' : 'Mostrar ocultos'}
        </button>
      </div>

      {list && visible.length === 0 && !scanning ? (
        <div className="card max-w-[640px] p-6">
          <h2 className="card-title">Nenhum jogo por aqui</h2>
          <p className="mt-1 text-muted">
            O FpsBoost encontra jogos da Steam, Epic, GOG e Ubisoft automaticamente. Para os de outras lojas (Battle.net, EA, Riot…), use
            "Adicionar jogo" e escolha o .exe.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
          {visible.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => setOpen(g)}
                className={`group relative block w-full overflow-hidden rounded-[12px] border border-line text-left shadow-[0_10px_30px_-12px_rgb(0_0_0_/0.7)] transition-transform hover:-translate-y-0.5 hover:border-primary/70 ${
                  g.hidden ? 'opacity-50' : ''
                }`}
              >
                <Cover game={g} className="aspect-[2/3] w-full" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-2.5 pt-10">
                  <p className="truncate text-[13.5px] font-semibold text-white">{g.name}</p>
                  <p className="flex items-center gap-1.5 text-[11.5px] text-white/70">
                    <span className="size-1.5 rounded-full" style={{ background: SOURCES[g.source].color }} />
                    {SOURCES[g.source].label}
                    {g.sizeGb ? ` · ${g.sizeGb.toLocaleString('pt-BR')} GB` : ''}
                  </p>
                </div>
                {Object.values(g.settings).some(Boolean) && (
                  <span className="absolute right-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10.5px] font-semibold text-white">Otimizado</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <GameDetail game={open} onClose={() => setOpen(null)} onChange={(g) => replace(g, open.id)} />}
    </>
  )
}
