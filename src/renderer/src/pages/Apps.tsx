import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, PackageX, RotateCcw, Search, Trash2 } from 'lucide-react'
import type { AppxEntry, AppxPreset, AppxRemoved, Leftover, OpResult, ProgramEntry, WingetApp } from '@shared/types'
import { Checkbox } from '../components/Checkbox'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { mb, useProgress } from '../lib/format'
import { toast } from '../lib/toast'

const PRESETS: { id: AppxPreset; label: string; text: string }[] = [
  { id: 'basic', label: 'Básico', text: 'Só propaganda de terceiros: jogos, streaming e redes sociais.' },
  { id: 'recommended', label: 'Recomendado', text: 'Também apps da Microsoft que quase ninguém usa.' },
  { id: 'extreme', label: 'Extremo', text: 'Inclui apps do sistema como Fotos, Paint, Calculadora e Xbox.' }
]
const ORDER: AppxPreset[] = ['basic', 'recommended', 'extreme']
const PRESET_TAG: Record<AppxPreset, string> = { basic: 'Básico', recommended: 'Recomendado', extreme: 'Extremo' }

function reportFailures(r: OpResult, what: string) {
  if (r.failed?.length) toast.error(`${r.failed.length} ${what} falharam:\n${r.failed.map((f) => `${f.id}: ${f.error}`).join('\n')}`)
  else if (r.error) toast.error(r.error)
}

// ---------------- Windows apps ----------------

function WindowsApps() {
  const [list, setList] = useState<AppxEntry[] | null>(null)
  const [history, setHistory] = useState<AppxRemoved[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'catalog' | 'all'>('catalog')
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const prog = useProgress('appx-remove')

  const load = () => {
    window.fps.invoke<AppxEntry[]>('apps:appx-list').then(setList)
    window.fps.invoke<AppxRemoved[]>('apps:appx-history').then(setHistory)
  }
  useEffect(load, [])

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (list ?? [])
      .filter((e) => (view === 'catalog' ? e.preset != null && e.installed : e.installed))
      .filter((e) => !s || `${e.title} ${e.name}`.toLowerCase().includes(s))
  }, [list, view, q])

  const applyPreset = (p: AppxPreset) =>
    setSel(new Set((list ?? []).filter((e) => e.installed && e.preset && ORDER.indexOf(e.preset) <= ORDER.indexOf(p)).map((e) => e.name)))

  const remove = async () => {
    setConfirm(false)
    setBusy(true)
    const r = await window.fps.invoke<OpResult>('apps:appx-remove', [...sel])
    setBusy(false)
    if (r.done) toast.ok(`${r.done} app(s) removido(s)`)
    reportFailures(r, 'apps')
    setSel(new Set())
    load()
  }

  const restore = async (h: AppxRemoved) => {
    toast.ok(`Reinstalando ${h.title} pela Microsoft Store…`)
    const r = await window.fps.invoke<OpResult>('apps:appx-restore', h.name)
    if (r.ok) toast.ok(`${h.title} reinstalado`)
    else toast.error(r.error ?? 'A reinstalação falhou.')
    load()
  }

  const selected = (list ?? []).filter((e) => sel.has(e.name))

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <section aria-label="Apps instalados" className="card min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Buscar app</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field w-full pl-9" placeholder="Buscar app" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div role="radiogroup" aria-label="Mostrar" className="flex h-[38px] rounded-[10px] border border-line p-0.5">
            {(
              [
                ['catalog', 'Conhecidos'],
                ['all', 'Todos instalados']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="radio"
                aria-checked={view === id}
                onClick={() => setView(id)}
                className={`rounded-[8px] px-3 text-[13px] ${view === id ? 'bg-card-2 text-ink' : 'text-muted hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {list == null ? (
          <p className="px-5 py-8 text-center text-muted">Lendo apps instalados…</p>
        ) : visible.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted">Nenhum app removível encontrado com esse filtro.</p>
        ) : (
          <ul className="max-h-[560px] overflow-y-auto">
            {visible.map((e) => (
              <li key={e.name} className="flex items-center gap-4 border-b border-line px-5 py-2.5 last:border-b-0">
                <Checkbox
                  label={e.title}
                  checked={sel.has(e.name)}
                  disabled={busy}
                  onChange={(v) =>
                    setSel((s) => {
                      const n = new Set(s)
                      v ? n.add(e.name) : n.delete(e.name)
                      return n
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {e.title}
                    {e.preset && <span className={`tag ${e.preset === 'extreme' ? 'text-ram' : ''}`}>{PRESET_TAG[e.preset]}</span>}
                  </p>
                  <p className="truncate text-[13px] text-muted">{e.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="text-[13px] text-muted">
            {busy && prog ? `Removendo ${prog.current} (${prog.done + 1}/${prog.total})…` : `${sel.size} selecionado(s)`}
          </p>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" disabled={busy || sel.size === 0} onClick={() => setSel(new Set())}>
              Limpar seleção
            </button>
            <button className="btn btn-danger btn-sm" disabled={busy || sel.size === 0} onClick={() => setConfirm(true)}>
              <Trash2 size={14} /> Remover {sel.size || ''}
            </button>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <section aria-labelledby="presets" className="card p-5">
          <h2 id="presets" className="card-title mb-1">
            Seleção rápida
          </h2>
          <p className="mb-3 text-[13px] text-muted">Marca os apps do nível escolhido. Você confere antes de remover.</p>
          <div className="flex flex-col gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                disabled={busy || !list}
                onClick={() => applyPreset(p.id)}
                className="rounded-[10px] border border-line bg-bg/40 px-3.5 py-2.5 text-left hover:border-primary/60 disabled:opacity-50"
              >
                <p className={`font-semibold ${p.id === 'extreme' ? 'text-ram' : ''}`}>{p.label}</p>
                <p className="text-[12.5px] text-muted">{p.text}</p>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted">
            A Microsoft Store, o winget, o Terminal, a Segurança do Windows e os codecs de mídia nunca aparecem nesta lista.
          </p>
        </section>

        <section aria-labelledby="removed" className="card p-5">
          <h2 id="removed" className="card-title mb-2">
            Removidos
          </h2>
          {history.length === 0 ? (
            <p className="text-[13px] text-muted">Os apps que você remover aparecem aqui, com a opção de reinstalar pela Store.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {history.map((h) => (
                <li key={h.name} className="flex items-center gap-3">
                  <PackageX size={16} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{h.title}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => restore(h)}>
                    <RotateCcw size={13} /> Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {confirm && (
        <Modal
          title={`Remover ${selected.length} app(s)?`}
          onClose={() => setConfirm(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={remove}>
                Remover
              </button>
            </>
          }
        >
          <p>Cada app sai da sua conta e da imagem do Windows, para não voltar em contas novas:</p>
          <ul>
            {selected.map((e) => (
              <li key={e.name}>{e.title}</li>
            ))}
          </ul>
          {selected.some((e) => e.preset === 'extreme') && (
            <p>
              <strong>Atenção:</strong> a seleção inclui apps do sistema (nível Extremo). Abrir fotos, PDFs ou prints pode passar a pedir
              outro programa.
            </p>
          )}
          <p>Apps com código da Store podem ser reinstalados depois em "Removidos".</p>
        </Modal>
      )}
    </div>
  )
}

// ---------------- Programs ----------------

function Programs() {
  const [list, setList] = useState<ProgramEntry[] | null>(null)
  const [q, setQ] = useState('')
  const [target, setTarget] = useState<ProgramEntry | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [left, setLeft] = useState<{ program: ProgramEntry; items: Leftover[] } | null>(null)
  const [leftSel, setLeftSel] = useState<Set<string>>(new Set())

  const load = () => window.fps.invoke<ProgramEntry[]>('apps:programs').then(setList)
  useEffect(() => {
    load()
  }, [])

  const visible = (list ?? []).filter((p) => !q.trim() || `${p.name} ${p.publisher}`.toLowerCase().includes(q.trim().toLowerCase()))

  const scanLeftovers = async (p: ProgramEntry) => {
    const items = await window.fps.invoke<Leftover[]>('apps:leftovers', p.id)
    if (items.length === 0) toast.ok(`Nenhuma sobra de ${p.name} encontrada.`)
    else {
      setLeft({ program: p, items })
      setLeftSel(new Set(items.map((i) => i.id)))
    }
  }

  const uninstall = async (p: ProgramEntry) => {
    setTarget(null)
    setRunning(p.id)
    const r = await window.fps.invoke<OpResult>('apps:uninstall', p.id)
    setRunning(null)
    if (!r.ok) {
      toast.error(r.error ?? 'A desinstalação falhou.')
      return load()
    }
    await load()
    await scanLeftovers(p)
  }

  const removeLeft = async () => {
    if (!left) return
    const r = await window.fps.invoke<OpResult>('apps:leftovers-remove', [...leftSel])
    if (r.done) toast.ok(`${r.done} sobra(s) removida(s). Pastas foram para a Lixeira.`)
    reportFailures(r, 'itens')
    setLeft(null)
  }

  return (
    <section aria-label="Programas instalados" className="card min-w-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">Buscar programa</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field w-full pl-9" placeholder="Buscar programa ou fabricante" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <p className="text-[13px] text-muted">{list ? `${list.length} programas` : ''}</p>
      </div>
      {list == null ? (
        <p className="px-5 py-8 text-center text-muted">Lendo programas instalados…</p>
      ) : (
        <div className="max-h-[620px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-[12.5px] text-muted">
                <th className="px-5 py-2 font-normal">Programa</th>
                <th className="px-3 py-2 font-normal">Versão</th>
                <th className="px-3 py-2 text-right font-normal">Tamanho</th>
                <th className="px-3 py-2 font-normal">Instalado em</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="max-w-[360px] px-5 py-2.5">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="truncate text-[12.5px] text-muted">{p.publisher || 'Fabricante desconhecido'}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-muted">{p.version || '—'}</td>
                  <td className="num px-3 py-2.5 text-right text-[14px]">{p.sizeMb ? mb(p.sizeMb) : '—'}</td>
                  <td className="px-3 py-2.5 text-[13px] text-muted">{p.installDate ? new Date(p.installDate + 'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-5 py-2.5 text-right">
                    <button className="btn btn-ghost btn-sm" disabled={!!running} onClick={() => setTarget(p)}>
                      {running === p.id ? 'Desinstalando…' : 'Desinstalar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {target && (
        <Modal
          title={`Desinstalar ${target.name}?`}
          onClose={() => setTarget(null)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setTarget(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={() => uninstall(target)}>
                Desinstalar
              </button>
            </>
          }
        >
          <p>O desinstalador do próprio programa vai abrir. Siga as etapas dele até o fim.</p>
          <p>Depois, o FpsBoost procura pastas e chaves de registro que ficaram para trás.</p>
        </Modal>
      )}

      {left && (
        <Modal
          title={`Sobras de ${left.program.name}`}
          onClose={() => setLeft(null)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setLeft(null)}>
                Manter
              </button>
              <button className="btn btn-danger" disabled={leftSel.size === 0} onClick={removeLeft}>
                Remover {leftSel.size}
              </button>
            </>
          }
        >
          <p>O programa foi desinstalado, mas estes itens ficaram. Pastas vão para a Lixeira; chaves de registro são copiadas para Backup antes.</p>
          <ul className="!list-none !pl-0">
            {left.items.map((i) => (
              <li key={i.id} className="mb-2 flex items-start gap-3">
                <Checkbox
                  label={i.path}
                  checked={leftSel.has(i.id)}
                  onChange={(v) =>
                    setLeftSel((s) => {
                      const n = new Set(s)
                      v ? n.add(i.id) : n.delete(i.id)
                      return n
                    })
                  }
                />
                <span className="min-w-0 break-all text-[13px]">
                  <span className="text-ink">{i.kind === 'folder' ? 'Pasta' : 'Registro'}</span> {i.path}
                  {i.sizeMb ? ` (${mb(i.sizeMb)})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </section>
  )
}

// ---------------- Install ----------------

function Install() {
  const [data, setData] = useState<{ available: boolean; apps: WingetApp[] } | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const prog = useProgress('winget')

  const load = () => window.fps.invoke<{ available: boolean; apps: WingetApp[] }>('apps:winget-list').then(setData)
  useEffect(() => {
    load()
  }, [])

  const groups = useMemo(() => {
    const m = new Map<string, WingetApp[]>()
    for (const a of data?.apps ?? []) m.set(a.category, [...(m.get(a.category) ?? []), a])
    return [...m.entries()]
  }, [data])

  const install = async () => {
    setBusy(true)
    const r = await window.fps.invoke<OpResult>('apps:winget-install', [...sel])
    setBusy(false)
    if (r.done) toast.ok(`${r.done} programa(s) instalado(s)`)
    reportFailures(r, 'instalações')
    setSel(new Set())
    load()
  }

  if (data && !data.available)
    return (
      <section className="card max-w-[640px] p-5">
        <h2 className="card-title">O winget não foi encontrado</h2>
        <p className="mt-2 text-muted">
          O instalador de pacotes do Windows vem no app "Instalador de Aplicativo" da Microsoft Store. Atualize-o pela Store e volte aqui.
        </p>
      </section>
    )

  return (
    <section aria-label="Instalar programas" className="card min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="text-[13px] text-muted">
          {busy && prog
            ? `Instalando ${data?.apps.find((a) => a.id === prog.current)?.name ?? prog.current} (${prog.done + 1}/${prog.total})…`
            : 'Instalação silenciosa pelo winget, direto das fontes oficiais de cada programa.'}
        </p>
        <button className="btn btn-primary btn-sm" disabled={busy || sel.size === 0} onClick={install}>
          <Download size={14} /> {busy ? 'Instalando…' : `Instalar ${sel.size || ''}`}
        </button>
      </div>
      {data == null ? (
        <p className="px-5 py-8 text-center text-muted">Verificando o que já está instalado…</p>
      ) : (
        <div className="grid gap-x-6 p-5 md:grid-cols-2">
          {groups.map(([cat, apps]) => (
            <div key={cat} className="mb-4">
              <h3 className="mb-2 text-[13px] font-semibold text-muted">{cat}</h3>
              <ul className="flex flex-col gap-1">
                {apps.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-[8px] px-1 py-1.5">
                    <Checkbox
                      label={a.name}
                      checked={sel.has(a.id)}
                      disabled={busy || a.installed}
                      onChange={(v) =>
                        setSel((s) => {
                          const n = new Set(s)
                          v ? n.add(a.id) : n.delete(a.id)
                          return n
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium">
                        {a.name} {a.installed && <span className="tag text-up">Instalado</span>}
                      </p>
                      <p className="truncate text-[12.5px] text-muted">{a.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ---------------- page ----------------

const TABS = [
  { id: 'windows', label: 'Apps do Windows' },
  { id: 'programs', label: 'Programas' },
  { id: 'install', label: 'Instalar' }
] as const

export function Apps() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as (typeof TABS)[number]['id']) ?? 'windows'
  return (
    <>
      <PageHeader title="Aplicativos" lead="Remova o que veio de fábrica, desinstale sem deixar sobras e instale o essencial para jogar." />
      <div role="tablist" aria-label="Seções de aplicativos" className="mb-4 inline-flex rounded-[12px] border border-line bg-card/70 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ tab: t.id })}
            className={`h-9 rounded-[9px] px-4 font-medium ${
              tab === t.id ? 'bg-gradient-to-r from-primary to-[#4f6ef7] text-white shadow-[0_6px_18px_-6px_rgb(59_130_246_/0.8)]' : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'windows' && <WindowsApps />}
      {tab === 'programs' && <Programs />}
      {tab === 'install' && <Install />}
    </>
  )
}
