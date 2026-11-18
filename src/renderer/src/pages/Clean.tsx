import { useEffect, useMemo, useState } from 'react'
import { Crown, FolderPlus, MemoryStick, ScanSearch, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react'
import type { CleanCategory, CleanResult, MemoryInfo, MemoryResult, RegistryCleanResult, RegistryIssue } from '@shared/types'
import { Checkbox } from '../components/Checkbox'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { useAccount, usePremium } from '../lib/account'
import { bytes, mb, useProgress } from '../lib/format'
import { toast } from '../lib/toast'

const KIND_LABEL: Record<RegistryIssue['kind'], string> = {
  startup: 'Inicialização',
  'app-path': 'Caminho de app',
  uninstall: 'Desinstalador'
}

function FilesCard() {
  const premium = usePremium()
  const openUpsell = useAccount((s) => s.openUpsell)
  const [cats, setCats] = useState<CleanCategory[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<'analyze' | 'clean' | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  const [confirm, setConfirm] = useState(false)
  const [last, setLast] = useState<CleanResult | null>(null)
  const prog = useProgress(busy === 'clean' ? 'clean' : 'analyze')

  const analyze = async () => {
    setBusy('analyze')
    try {
      const list = await window.fps.invoke<CleanCategory[]>('clean:analyze')
      setCats(list)
      setSel(new Set(list.filter((c) => !c.optIn && !c.needsAdmin && c.bytes > 0).map((c) => c.id)))
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    window.fps.invoke<string[]>('clean:folders').then(setFolders)
    analyze()
  }, [])

  const selectedBytes = useMemo(() => (cats ?? []).filter((c) => sel.has(c.id)).reduce((s, c) => s + c.bytes, 0), [cats, sel])
  const total = (cats ?? []).reduce((s, c) => s + c.bytes, 0)
  const max = Math.max(1, ...(cats ?? []).map((c) => c.bytes))

  const run = async () => {
    setConfirm(false)
    setBusy('clean')
    try {
      const r = await window.fps.invoke<{ ok: boolean; error?: string; result?: CleanResult }>('clean:run', [...sel])
      if (!r.ok || !r.result) return toast.error(r.error ?? 'A limpeza não foi concluída.')
      setLast(r.result)
      toast.ok(`${bytes(r.result.freedBytes)} liberados${r.result.skipped ? ` (${r.result.skipped} arquivos em uso ficaram)` : ''}`)
    } finally {
      setBusy(null)
    }
    analyze()
  }

  const addFolder = async () => {
    const r = await window.fps.invoke<{ ok: boolean; error?: string; folders?: string[] }>('clean:folders-add')
    if (r.folders) setFolders(r.folders)
    if (r.error) toast.error(r.error)
    if (r.ok) analyze()
  }

  return (
    <section aria-labelledby="files" className="card flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 id="files" className="card-title">
            Arquivos
          </h2>
          <p className="text-[13px] text-muted">
            {busy === 'analyze'
              ? `Analisando${prog?.current ? ` ${cats?.find((c) => c.id === prog.current)?.label ?? ''}` : ''}…`
              : cats
                ? `${bytes(total)} encontrados, ${bytes(selectedBytes)} selecionados`
                : ''}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={analyze}>
          <ScanSearch size={14} /> Analisar de novo
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={!!busy || sel.size === 0 || selectedBytes === 0}
          onClick={() => (premium ? setConfirm(true) : openUpsell())}
        >
          {premium ? <Trash2 size={14} /> : <Crown size={14} />}
          {busy === 'clean' ? 'Limpando…' : `Limpar ${bytes(selectedBytes)}`}
        </button>
      </div>

      {last && (
        <p className="border-b border-line bg-up/10 px-5 py-2.5 text-[13px] text-up">
          Última limpeza: {bytes(last.freedBytes)} liberados em {last.deleted.toLocaleString('pt-BR')} arquivos
          {last.skipped ? `; ${last.skipped.toLocaleString('pt-BR')} estavam em uso e ficaram` : ''}.
        </p>
      )}

      <ul>
        {(cats ?? []).map((c) => (
          <li key={c.id} className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-b-0">
            <Checkbox
              label={c.label}
              checked={sel.has(c.id)}
              disabled={!!busy}
              onChange={(v) =>
                setSel((s) => {
                  const n = new Set(s)
                  v ? n.add(c.id) : n.delete(c.id)
                  return n
                })
              }
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {c.label}
                {c.needsAdmin && (
                  <span className="tag text-ram">
                    <ShieldAlert size={11} /> Precisa de administrador
                  </span>
                )}
              </p>
              <p className="text-[13px] text-muted">{c.description}</p>
            </div>
            <div className="w-36 shrink-0 text-right">
              <p className="num text-[15px] font-semibold">{bytes(c.bytes)}</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-chart-disk" style={{ width: `${(c.bytes / max) * 100}%` }} />
              </div>
              <p className="mt-0.5 text-[11.5px] text-muted">{c.files.toLocaleString('pt-BR')} arquivos</p>
            </div>
          </li>
        ))}
        {!cats && busy === 'analyze' && <li className="px-5 py-8 text-center text-muted">Medindo o tamanho de cada categoria…</li>}
      </ul>

      <div className="mt-auto border-t border-line px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted">Pastas personalizadas: todo o conteúdo delas entra na limpeza.</p>
          <button className="btn btn-ghost btn-sm" onClick={addFolder}>
            <FolderPlus size={14} /> Adicionar pasta
          </button>
        </div>
        {folders.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {folders.map((f) => (
              <li key={f} className="tag h-7 max-w-full gap-2 pr-1">
                <span className="truncate">{f}</span>
                <button
                  aria-label={`Remover ${f}`}
                  className="grid size-5 place-items-center rounded-full hover:bg-card-2"
                  onClick={async () => {
                    setFolders(await window.fps.invoke<string[]>('clean:folders-remove', f))
                    analyze()
                  }}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirm && (
        <Modal
          title={`Limpar ${bytes(selectedBytes)}?`}
          onClose={() => setConfirm(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={run}>
                Limpar
              </button>
            </>
          }
        >
          <p>Os arquivos destas categorias serão apagados definitivamente (não vão para a Lixeira):</p>
          <ul>
            {(cats ?? [])
              .filter((c) => sel.has(c.id))
              .map((c) => (
                <li key={c.id}>
                  {c.label}: {bytes(c.bytes)}
                </li>
              ))}
          </ul>
          <p>Arquivos em uso por programas abertos são pulados.</p>
        </Modal>
      )}
    </section>
  )
}

function MemoryCard() {
  const premium = usePremium()
  const openUpsell = useAccount((s) => s.openUpsell)
  const [info, setInfo] = useState<MemoryInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<MemoryResult | null>(null)

  const load = () => window.fps.invoke<MemoryInfo>('memory:info').then(setInfo)
  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  const used = info ? info.totalMb - info.availableMb : 0
  const pct = info ? Math.round((used / info.totalMb) * 100) : 0

  const free = async () => {
    if (!premium) return openUpsell()
    setBusy(true)
    const r = await window.fps.invoke<MemoryResult>('memory:free')
    setBusy(false)
    if (!r.ok) return toast.error(r.error ?? 'Não foi possível liberar a memória.')
    setLast(r)
    toast.ok(`${mb(r.freedMb)} de memória liberados`)
    load()
  }

  return (
    <section aria-labelledby="ram" className="card p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-card-2 text-ink">
          <MemoryStick size={18} />
        </span>
        <h2 id="ram" className="card-title flex-1">
          Memória RAM
        </h2>
        <span className="num text-[22px] font-semibold">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-chart-ram transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-muted">{info ? `${mb(used)} em uso, ${mb(info.availableMb)} livres de ${mb(info.totalMb)}` : 'Lendo memória…'}</p>
      <p className="mt-3 text-[13px] text-muted">
        Esvazia a memória que os programas reservaram e não estão usando, e a lista de espera do Windows. Útil antes de abrir um jogo pesado.
      </p>
      <button className="btn btn-primary btn-sm mt-4 w-full" disabled={busy} onClick={free}>
        {premium ? <Sparkles size={14} /> : <Crown size={14} />}
        {busy ? 'Liberando…' : 'Liberar memória'}
      </button>
      {last && (
        <p className="mt-2 text-center text-[12.5px] text-up">
          {mb(last.freedMb)} liberados{last.standbyPurged ? ', lista de espera esvaziada' : ''}
        </p>
      )}
    </section>
  )
}

function RegistryCard() {
  const premium = usePremium()
  const openUpsell = useAccount((s) => s.openUpsell)
  const [issues, setIssues] = useState<RegistryIssue[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const scan = async () => {
    setBusy(true)
    const list = await window.fps.invoke<RegistryIssue[]>('registry:scan')
    setIssues(list)
    setSel(new Set(list.map((i) => i.id)))
    setBusy(false)
  }

  const clean = async () => {
    if (!premium) return openUpsell()
    setBusy(true)
    const r = await window.fps.invoke<RegistryCleanResult>('registry:clean', [...sel])
    setBusy(false)
    if (r.removed) toast.ok(`${r.removed} entradas removidas. A cópia de segurança está em Backup.`)
    if (r.error) toast.error(r.error)
    scan()
  }

  return (
    <section aria-labelledby="reg" className="card p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="reg" className="card-title">
          Registro
        </h2>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={scan}>
          <ScanSearch size={14} /> {issues ? 'Verificar de novo' : 'Verificar'}
        </button>
      </div>
      <p className="text-[13px] text-muted">
        Procura só entradas que apontam para programas que não existem mais: inicialização, caminhos de app e desinstaladores. Cada
        uma é copiada para Backup antes de sair.
      </p>
      {issues && issues.length === 0 && <p className="mt-3 text-[13px] text-up">Nenhuma entrada quebrada encontrada.</p>}
      {issues && issues.length > 0 && (
        <>
          <ul className="mt-3 flex max-h-[220px] flex-col gap-1 overflow-y-auto">
            {issues.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-[8px] px-1 py-1.5">
                <Checkbox
                  label={i.name}
                  checked={sel.has(i.id)}
                  onChange={(v) =>
                    setSel((s) => {
                      const n = new Set(s)
                      v ? n.add(i.id) : n.delete(i.id)
                      return n
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px]">{i.name}</p>
                  <p className="truncate text-[12px] text-muted" title={i.target}>
                    {KIND_LABEL[i.kind]}: {i.target}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary btn-sm mt-3 w-full" disabled={busy || sel.size === 0} onClick={clean}>
            {!premium && <Crown size={14} />} Remover {sel.size} {sel.size === 1 ? 'entrada' : 'entradas'}
          </button>
        </>
      )}
    </section>
  )
}

export function Clean() {
  return (
    <>
      <PageHeader title="Limpeza" lead="Libere espaço em disco e memória. A análise é gratuita; limpar faz parte do plano Premium." />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <FilesCard />
        <div className="flex flex-col gap-4">
          <MemoryCard />
          <RegistryCard />
        </div>
      </div>
    </>
  )
}
