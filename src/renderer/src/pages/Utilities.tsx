import { useEffect, useState } from 'react'
import { Gauge, HardDrive, RefreshCw, RotateCcw, Wifi } from 'lucide-react'
import type { DiskVolume, DnsProvider, OpResult } from '@shared/types'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { toast } from '../lib/toast'

function DnsCard() {
  const [list, setList] = useState<DnsProvider[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const bench = async () => {
    setBusy('bench')
    setList(await window.fps.invoke<DnsProvider[]>('utils:dns-benchmark'))
    setBusy(null)
  }

  const apply = async (id: string, name: string) => {
    setBusy(id)
    const r = await window.fps.invoke<OpResult>('utils:dns-apply', id)
    setBusy(null)
    if (r.ok) toast.ok(id === 'auto' ? 'DNS voltou para o automático' : `DNS trocado para ${name}`)
    else toast.error(r.error ?? 'Não foi possível trocar o DNS.')
    bench()
  }

  const valid = (list ?? []).filter((p) => p.ms != null)
  const best = valid.length ? valid.reduce((a, b) => (a.ms! <= b.ms! ? a : b)) : null
  const max = Math.max(1, ...valid.map((p) => p.ms!))

  return (
    <section aria-labelledby="dns" className="card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4">
        <span className="grid size-9 place-items-center rounded-full bg-card-2">
          <Gauge size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="dns" className="card-title">
            DNS mais rápido
          </h2>
          <p className="text-[13px] text-muted">Mede quanto cada servidor demora para responder daqui, com nomes de jogos e lojas.</p>
        </div>
        <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={bench}>
          <RefreshCw size={14} className={busy === 'bench' ? 'animate-spin' : ''} /> {busy === 'bench' ? 'Medindo…' : list ? 'Medir de novo' : 'Medir'}
        </button>
      </div>
      {!list ? (
        <p className="px-6 py-6 text-muted">Clique em Medir. Leva até um minuto.</p>
      ) : (
        <ul>
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-4 border-b border-line px-6 py-3 last:border-b-0">
              <div className="w-[190px] shrink-0">
                <p className="flex items-center gap-2 font-semibold">
                  {p.name}
                  {p.current && <span className="tag">Em uso</span>}
                </p>
                <p className="text-[12.5px] text-muted">{p.servers.join(', ') || 'Definido pelo roteador'}</p>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-grid)]">
                  {p.ms != null && <div className={`h-full rounded-full ${p === best ? 'bg-up' : 'bg-chart-cpu'}`} style={{ width: `${(p.ms / max) * 100}%` }} />}
                </div>
                <span className="num w-16 text-right text-[15px]">{p.ms != null ? `${Math.round(p.ms)} ms` : 'sem resposta'}</span>
              </div>
              {p.id !== 'current' && !p.current ? (
                <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => apply(p.id, p.name)}>
                  {busy === p.id ? 'Trocando…' : 'Usar'}
                </button>
              ) : (
                <span className="w-[64px]" />
              )}
            </li>
          ))}
        </ul>
      )}
      {list && !list.some((p) => p.id === 'current') && (
        <div className="border-t border-line px-6 py-3">
          <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => apply('auto', 'automático')}>
            <RotateCcw size={13} /> Voltar para o DNS automático
          </button>
        </div>
      )}
    </section>
  )
}

function DisksCard() {
  const [vols, setVols] = useState<DiskVolume[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    window.fps.invoke<DiskVolume[]>('utils:volumes').then(setVols)
  }, [])
  const optimize = async (v: DiskVolume) => {
    setBusy(v.letter)
    const r = await window.fps.invoke<OpResult>('utils:optimize', v.letter)
    setBusy(null)
    if (r.ok) toast.ok(`Unidade ${v.letter}: otimizada`)
    else toast.error(r.error ?? 'A otimização falhou.')
  }
  return (
    <section aria-labelledby="disks" className="card">
      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <span className="grid size-9 place-items-center rounded-full bg-card-2">
          <HardDrive size={17} />
        </span>
        <div>
          <h2 id="disks" className="card-title">
            Otimizar discos
          </h2>
          <p className="text-[13px] text-muted">SSD recebe TRIM; HD recebe desfragmentação.</p>
        </div>
      </div>
      <ul>
        {(vols ?? []).map((v) => (
          <li key={v.letter} className="flex items-center gap-4 border-b border-line px-6 py-3 last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {v.letter}: {v.label} <span className="tag ml-1">{v.media === 'Unspecified' ? 'Tipo desconhecido' : v.media}</span>
              </p>
              <p className="text-[13px] text-muted">
                {v.freeGb} GB livres de {v.sizeGb} GB
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => optimize(v)}>
              {busy === v.letter ? 'Otimizando…' : 'Otimizar'}
            </button>
          </li>
        ))}
        {vols == null && <li className="px-6 py-6 text-muted">Lendo unidades…</li>}
      </ul>
    </section>
  )
}

function NetworkCard() {
  const [confirm, setConfirm] = useState(false)
  const run = async (channel: 'utils:flush-dns' | 'utils:reset-network' | 'app:restart-explorer', ok: string) => {
    const r = await window.fps.invoke<OpResult>(channel)
    if (r.ok) toast.ok(ok)
    else toast.error(r.error ?? 'Não foi possível concluir.')
  }
  const rows: { title: string; text: string; action: () => void; label: string }[] = [
    { title: 'Limpar cache de DNS', text: 'Resolve sites e servidores que pararam de abrir depois de mudarem de endereço.', action: () => run('utils:flush-dns', 'Cache de DNS limpo'), label: 'Limpar' },
    { title: 'Redefinir a rede', text: 'Recria o Winsock e a pilha TCP/IP. Use quando a internet falha só neste PC. Pede reinício.', action: () => setConfirm(true), label: 'Redefinir' },
    { title: 'Reiniciar o Explorador', text: 'Recarrega a barra de tarefas e o menu Iniciar.', action: () => run('app:restart-explorer', 'Explorador reiniciado'), label: 'Reiniciar' }
  ]
  return (
    <section aria-labelledby="net" className="card">
      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <span className="grid size-9 place-items-center rounded-full bg-card-2">
          <Wifi size={17} />
        </span>
        <h2 id="net" className="card-title">
          Rede e sistema
        </h2>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.title} className="flex items-center gap-4 border-b border-line px-6 py-3 last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.title}</p>
              <p className="text-[13px] text-muted">{r.text}</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={r.action}>
              {r.label}
            </button>
          </li>
        ))}
      </ul>
      {confirm && (
        <Modal
          title="Redefinir a rede?"
          onClose={() => setConfirm(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setConfirm(false)
                  run('utils:reset-network', 'Rede redefinida. Reinicie o computador para concluir.')
                }}
              >
                Redefinir
              </button>
            </>
          }
        >
          <p>O Winsock e a pilha TCP/IP voltam ao padrão do Windows. VPNs e programas que mexem na rede podem precisar ser reinstalados.</p>
          <p>A mudança vale depois de reiniciar o computador.</p>
        </Modal>
      )}
    </section>
  )
}

export function Utilities() {
  return (
    <>
      <PageHeader title="Utilitários" lead="Ferramentas rápidas para rede, disco e sistema." />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DnsCard />
        <div className="flex flex-col gap-5">
          <DisksCard />
          <NetworkCard />
        </div>
      </div>
    </>
  )
}
