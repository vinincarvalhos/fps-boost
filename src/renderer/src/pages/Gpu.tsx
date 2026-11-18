import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Download, ExternalLink, RotateCcw, ShieldCheck, Zap } from 'lucide-react'
import type { GpuMetrics, GpuState, NvSettingOption, OpResult } from '@shared/types'
import { Checkbox } from '../components/Checkbox'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { useAccount, usePremium } from '../lib/account'
import { toast } from '../lib/toast'

interface Options {
  options: NvSettingOption[]
  npi: { version: string; sizeKb: number; url: string }
}

function Stat({ label, value, unit }: { label: string; value: number | string | null | undefined; unit: string }) {
  return (
    <div>
      <p className="text-[13px] text-muted-on-dark">{label}</p>
      <p className="num mt-1 text-[28px] font-semibold">
        {value ?? '—'}
        {value != null && <span className="ml-1 text-[15px] text-muted-on-dark">{unit}</span>}
      </p>
    </div>
  )
}

function Metrics({ state }: { state: GpuState }) {
  const [m, setM] = useState<GpuMetrics | null>(null)
  useEffect(() => {
    if (!state.metricsAvailable) return
    let alive = true
    const tick = async () => {
      const r = await window.fps.invoke<GpuMetrics | null>('gpu:metrics')
      if (alive) {
        setM(r)
        setTimeout(tick, 2000)
      }
    }
    tick()
    return () => {
      alive = false
    }
  }, [state.metricsAvailable])

  return (
    <section aria-labelledby="gpu-hero" className="tile-dark mb-6 px-10 py-9">
      <p className="text-[14px] text-muted-on-dark">{state.vendor === 'nvidia' ? 'NVIDIA' : state.vendor === 'amd' ? 'AMD' : state.vendor === 'intel' ? 'Intel' : 'Placa de vídeo'}</p>
      <h2 id="gpu-hero" className="mt-1 text-[34px] font-semibold leading-[1.1]">
        {m?.name.replace(/^NVIDIA\s+/, '') ?? state.model}
      </h2>
      <p className="mt-1 text-[14px] text-muted-on-dark">Driver {m?.driver ?? state.driver ?? '—'}</p>
      {state.metricsAvailable ? (
        <div className="mt-7 grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Uso" value={m?.loadPct} unit="%" />
          <Stat label="Temperatura" value={m?.tempC} unit="°C" />
          <Stat label="Clock do núcleo" value={m?.coreMhz} unit="MHz" />
          <Stat label="Clock da memória" value={m?.memMhz} unit="MHz" />
          <Stat label="Consumo" value={m?.powerW} unit={m?.powerLimitW ? `W de ${m.powerLimitW}` : 'W'} />
          <Stat label="VRAM em uso" value={m?.vramUsedMb != null ? (m.vramUsedMb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : null} unit={m?.vramTotalMb ? `de ${Math.round(m.vramTotalMb / 1024)} GB` : 'GB'} />
        </div>
      ) : (
        <p className="mt-6 text-[15px] text-muted-on-dark">Métricas detalhadas em tempo real estão disponíveis para placas NVIDIA.</p>
      )}
    </section>
  )
}

function NvidiaOptimizer({ state, reload }: { state: GpuState; reload: () => void }) {
  const premium = usePremium()
  const openUpsell = useAccount((s) => s.openUpsell)
  const [opts, setOpts] = useState<Options | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<'download' | 'apply' | 'restore' | null>(null)
  const [confirmDl, setConfirmDl] = useState(false)

  useEffect(() => {
    window.fps.invoke<Options>('gpu:options').then((o) => {
      setOpts(o)
      setSel(new Set(state.appliedKeys.length ? state.appliedKeys : o.options.filter((x) => x.recommended).map((x) => x.key)))
    })
  }, [state.appliedKeys])

  const download = async () => {
    setConfirmDl(false)
    setBusy('download')
    const r = await window.fps.invoke<OpResult>('gpu:download-npi')
    setBusy(null)
    if (r.ok) toast.ok('NVIDIA Profile Inspector baixado e verificado')
    else toast.error(r.error ?? 'O download falhou.')
    reload()
  }

  const apply = async () => {
    if (!premium) return openUpsell()
    setBusy('apply')
    const r = await window.fps.invoke<OpResult>('gpu:apply', [...sel])
    setBusy(null)
    if (r.ok) toast.ok(`${r.done} configurações aplicadas no painel da NVIDIA. Abra os jogos de novo para valer.`)
    else toast.error(r.error ?? 'Não foi possível aplicar.')
    reload()
  }

  const restore = async () => {
    setBusy('restore')
    const r = await window.fps.invoke<OpResult>('gpu:restore')
    setBusy(null)
    if (r.ok) toast.ok('Perfil da NVIDIA restaurado como estava antes do FpsBoost')
    else toast.error(r.error ?? 'Não foi possível restaurar.')
    reload()
  }

  return (
    <section aria-labelledby="nv" className="card">
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 id="nv" className="card-title">
            Painel de controle da NVIDIA
          </h2>
          <p className="text-[13px] text-muted">
            {state.appliedAt
              ? `Aplicado em ${new Date(state.appliedAt).toLocaleString('pt-BR')}. As outras configurações do seu painel não foram mexidas.`
              : 'Ajusta o perfil global do driver. As configurações que você já mudou e não estão marcadas aqui continuam como estão.'}
          </p>
        </div>
        {state.backupAt && (
          <button className="btn btn-ghost btn-sm" disabled={!!busy || !state.npiReady} onClick={restore}>
            <RotateCcw size={14} /> {busy === 'restore' ? 'Restaurando…' : 'Restaurar o anterior'}
          </button>
        )}
        {state.npiReady ? (
          <button className="btn btn-primary btn-sm" disabled={!!busy || sel.size === 0} onClick={apply}>
            {premium ? <Zap size={14} /> : <Crown size={14} />}
            {busy === 'apply' ? 'Aplicando…' : `Aplicar ${sel.size}`}
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => setConfirmDl(true)}>
            <Download size={14} /> {busy === 'download' ? 'Baixando…' : 'Preparar otimizador'}
          </button>
        )}
      </div>

      <ul>
        {(opts?.options ?? []).map((o) => (
          <li key={o.key} className="flex items-start gap-4 border-b border-line px-6 py-3 last:border-b-0">
            <div className="pt-0.5">
              <Checkbox
                label={o.title}
                checked={sel.has(o.key)}
                disabled={!!busy}
                onChange={(v) =>
                  setSel((s) => {
                    const n = new Set(s)
                    v ? n.add(o.key) : n.delete(o.key)
                    return n
                  })
                }
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {o.title}
                {state.appliedKeys.includes(o.key) && <span className="tag text-up">Aplicado</span>}
                {!o.recommended && <span className="tag">Opcional</span>}
              </p>
              <p className="text-[13px] text-muted">{o.description}</p>
            </div>
          </li>
        ))}
      </ul>

      {confirmDl && opts && (
        <Modal
          title="Baixar o NVIDIA Profile Inspector?"
          onClose={() => setConfirmDl(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmDl(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={download}>
                Baixar ({opts.npi.sizeKb} KB)
              </button>
            </>
          }
        >
          <p>
            O FpsBoost usa o <strong>NVIDIA Profile Inspector</strong> {opts.npi.version}, um programa de código aberto (licença MIT), para gravar as
            configurações no driver da NVIDIA.
          </p>
          <p>
            Ele é baixado da página oficial do projeto no GitHub e só é usado se a assinatura SHA-256 bater com a da versão oficial. Fica guardado na
            pasta do FpsBoost.
          </p>
          <p>
            <a href={opts.npi.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Ver o projeto no GitHub <ExternalLink size={13} />
            </a>
          </p>
        </Modal>
      )}
    </section>
  )
}

export function Gpu() {
  const [state, setState] = useState<GpuState | null>(null)
  const load = () => window.fps.invoke<GpuState>('gpu:state').then(setState)
  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <PageHeader title="Placa de vídeo" lead="Acompanhe a GPU em tempo real e ajuste o driver para menos latência e mais FPS." />
      {!state ? (
        <p className="text-muted">Identificando a placa de vídeo…</p>
      ) : (
        <>
          <Metrics state={state} />
          {state.vendor === 'nvidia' ? (
            <NvidiaOptimizer state={state} reload={load} />
          ) : (
            <section className="card max-w-[720px] p-6">
              <h2 className="card-title">{state.vendor === 'amd' ? 'AMD Software: Adrenalin' : 'Configurações do driver'}</h2>
              <p className="mt-1 text-muted">
                {state.vendor === 'amd'
                  ? 'As configurações de placas AMD ficam no AMD Software. Para jogos, ative Radeon Anti-Lag e desative Radeon Chill e Enhanced Sync.'
                  : 'O otimizador do FpsBoost funciona com placas NVIDIA. Os ajustes de GPU do Windows continuam disponíveis em Ajustes.'}
              </p>
              <div className="mt-4 flex gap-2">
                {state.vendor === 'amd' && (
                  <button className="btn btn-primary btn-sm" onClick={() => window.fps.invoke('gpu:open-amd')}>
                    Abrir AMD Software
                  </button>
                )}
                <Link to="/tweaks?c=Jogos" className="btn btn-ghost btn-sm">
                  Ajustes de jogos
                </Link>
              </div>
            </section>
          )}
          <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
            <ShieldCheck size={14} /> Antes da primeira mudança, o FpsBoost guarda uma cópia do perfil global do driver para você poder voltar atrás.
          </p>
        </>
      )}
    </>
  )
}
