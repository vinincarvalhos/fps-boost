import { useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, RefreshCw } from 'lucide-react'
import type { DriverInfo, DriverUpdate, OpResult } from '@shared/types'
import { Checkbox } from '../components/Checkbox'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { useLive } from '../lib/live'
import { toast } from '../lib/toast'

const age = (d?: number) => (d == null ? '—' : d < 31 ? `${d} dias` : d < 365 ? `${Math.round(d / 30)} meses` : `${(d / 365).toFixed(1).replace('.', ',')} anos`)

export function Drivers() {
  const gpu = useLive((s) => s.info?.gpus.find((g) => /nvidia|amd|radeon/i.test(`${g.vendor} ${g.model}`)) ?? s.info?.gpus[0])
  const [list, setList] = useState<DriverInfo[] | null>(null)
  const [updates, setUpdates] = useState<DriverUpdate[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    window.fps.invoke<DriverInfo[]>('drivers:list').then(setList)
  }, [])

  const search = async () => {
    setSearching(true)
    const r = await window.fps.invoke<{ ok: boolean; updates: DriverUpdate[]; error?: string }>('drivers:search')
    setSearching(false)
    if (!r.ok) return toast.error(r.error ?? 'A busca falhou.')
    setUpdates(r.updates)
    setSel(new Set(r.updates.map((u) => u.id)))
  }

  const install = async () => {
    setConfirm(false)
    setInstalling(true)
    const r = await window.fps.invoke<OpResult & { reboot?: boolean }>('drivers:install', [...sel])
    setInstalling(false)
    if (r.done) toast.ok(`${r.done} driver(s) instalado(s)${r.reboot ? '. Reinicie o computador para concluir.' : '.'}`)
    if (!r.ok) toast.error(r.error ?? 'A instalação falhou.')
    window.fps.invoke<DriverInfo[]>('drivers:list').then(setList)
    search()
  }

  const groups = useMemo(() => {
    const m = new Map<string, DriverInfo[]>()
    for (const d of list ?? []) m.set(d.kind, [...(m.get(d.kind) ?? []), d])
    return [...m.entries()]
  }, [list])

  const vendor = /nvidia/i.test(`${gpu?.vendor} ${gpu?.model}`) ? 'nvidia' : /amd|radeon/i.test(`${gpu?.vendor} ${gpu?.model}`) ? 'amd' : /intel/i.test(`${gpu?.vendor}`) ? 'intel' : null
  const chosen = (updates ?? []).filter((u) => sel.has(u.id))

  return (
    <>
      <PageHeader title="Drivers" lead="Veja a idade de cada driver e instale as atualizações oficiais pelo Windows Update." />

      <div className="mb-6 grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="wu" className="card">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4">
            <div className="min-w-0 flex-1">
              <h2 id="wu" className="card-title">
                Atualizações pelo Windows Update
              </h2>
              <p className="text-[13px] text-muted">
                {searching ? 'Procurando… pode levar alguns minutos.' : updates == null ? 'Drivers certificados pela Microsoft para o seu hardware.' : updates.length ? `${updates.length} disponíveis` : 'Nenhuma atualização de driver disponível.'}
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" disabled={searching || installing} onClick={search}>
              <RefreshCw size={14} className={searching ? 'animate-spin' : ''} /> Procurar
            </button>
            {!!updates?.length && (
              <button className="btn btn-primary btn-sm" disabled={installing || sel.size === 0} onClick={() => setConfirm(true)}>
                <Download size={14} /> {installing ? 'Instalando…' : `Instalar ${sel.size}`}
              </button>
            )}
          </div>
          {!!updates?.length && (
            <ul>
              {updates.map((u) => (
                <li key={u.id} className="flex items-start gap-4 border-b border-line px-6 py-3 last:border-b-0">
                  <div className="pt-0.5">
                    <Checkbox
                      label={u.title}
                      checked={sel.has(u.id)}
                      disabled={installing}
                      onChange={(v) =>
                        setSel((s) => {
                          const n = new Set(s)
                          v ? n.add(u.id) : n.delete(u.id)
                          return n
                        })
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{u.title}</p>
                    <p className="text-[13px] text-muted">
                      {[u.provider, u.driverClass, u.date && new Date(u.date + 'T12:00').toLocaleDateString('pt-BR'), u.sizeMb ? `${u.sizeMb} MB` : ''].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="gpu-drv" className="tile-dark p-7">
          <h2 id="gpu-drv" className="text-[21px] font-semibold">
            Driver da placa de vídeo
          </h2>
          <p className="mt-1 text-[15px] text-muted-on-dark">
            {gpu ? `${gpu.model}, versão ${gpu.driver ?? '—'}` : 'Lendo…'}
          </p>
          <p className="mt-3 text-[14px] text-muted-on-dark">
            O Windows Update costuma trazer versões mais antigas do driver de vídeo. Para jogos, use o instalador oficial do fabricante.
          </p>
          {vendor && (
            <button className="btn btn-primary mt-5" onClick={() => window.fps.invoke('drivers:vendor-page', vendor)}>
              {vendor === 'nvidia' ? 'Abrir o NVIDIA App' : vendor === 'amd' ? 'Abrir o site da AMD' : 'Abrir o assistente da Intel'} <ExternalLink size={14} />
            </button>
          )}
        </section>
      </div>

      <section aria-labelledby="inv" className="card">
        <h2 id="inv" className="card-title border-b border-line px-6 py-4">
          Drivers instalados
        </h2>
        {list == null ? (
          <p className="px-6 py-6 text-muted">Lendo drivers…</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[12.5px] text-muted">
                <th className="px-6 py-2 font-normal">Dispositivo</th>
                <th className="px-3 py-2 font-normal">Fabricante</th>
                <th className="px-3 py-2 font-normal">Versão</th>
                <th className="px-6 py-2 text-right font-normal">Idade</th>
              </tr>
            </thead>
            {groups.map(([kind, items]) => (
              <tbody key={kind}>
                <tr>
                  <th colSpan={4} className="bg-card-2 px-6 py-1.5 text-left text-[13px] font-semibold">
                    {kind}
                  </th>
                </tr>
                {items.map((d) => (
                  <tr key={d.name + d.version} className="border-t border-line">
                    <td className="max-w-[380px] truncate px-6 py-2.5">{d.name}</td>
                    <td className="px-3 py-2.5 text-[13px] text-muted">{d.provider}</td>
                    <td className="num px-3 py-2.5 text-[14px] text-muted">{d.version}</td>
                    <td className={`px-6 py-2.5 text-right text-[13px] ${d.ageDays != null && d.ageDays > 730 ? 'text-ram' : 'text-muted'}`}>{age(d.ageDays)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        )}
      </section>

      {confirm && (
        <Modal
          title={`Instalar ${chosen.length} driver(s)?`}
          onClose={() => setConfirm(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={install}>
                Instalar
              </button>
            </>
          }
        >
          <p>O Windows Update vai baixar e instalar:</p>
          <ul>
            {chosen.map((u) => (
              <li key={u.id}>{u.title}</li>
            ))}
          </ul>
          <p>A tela pode piscar durante a instalação de drivers de vídeo ou rede. Alguns pedem reinício.</p>
        </Modal>
      )}
    </>
  )
}
