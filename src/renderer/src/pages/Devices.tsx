import { useEffect, useState } from 'react'
import { Keyboard, Mouse, RotateCcw } from 'lucide-react'
import type { InputPrefs, MsiDevice, OpResult } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Toggle } from '../components/Toggle'
import { toast } from '../lib/toast'

const KIND: Record<MsiDevice['kind'], string> = {
  gpu: 'Placa de vídeo',
  network: 'Rede',
  usb: 'USB',
  audio: 'Áudio',
  storage: 'Armazenamento',
  other: 'Outro'
}

function MsiCard({ onRestart }: { onRestart: () => void }) {
  const [list, setList] = useState<MsiDevice[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const load = () => window.fps.invoke<MsiDevice[]>('devices:msi').then(setList)
  useEffect(() => {
    load()
  }, [])

  const toggle = async (d: MsiDevice) => {
    setBusy(d.instanceId)
    const r = await window.fps.invoke<OpResult>('devices:set-msi', d.instanceId, !d.msi)
    setBusy(null)
    if (r.ok) {
      toast.ok(`Modo MSI ${d.msi ? 'desligado' : 'ligado'} em ${d.name}. Vale depois de reiniciar.`)
      onRestart()
    } else toast.error(r.error ?? 'Não foi possível alterar.')
    load()
  }

  return (
    <section aria-labelledby="msi" className="card">
      <div className="border-b border-line px-6 py-4">
        <h2 id="msi" className="card-title">
          Interrupções em modo MSI
        </h2>
        <p className="text-[13px] text-muted">
          O modo MSI deixa a placa de vídeo, a rede e o USB avisarem a CPU com menos atraso. O FpsBoost só liga; e só desliga onde ele mesmo ligou.
        </p>
      </div>
      {list == null ? (
        <p className="px-6 py-6 text-muted">Lendo dispositivos…</p>
      ) : (
        <ul>
          {list.map((d) => {
            const locked = d.msi === true && !d.changedByApp
            return (
              <li key={d.instanceId} className="flex items-center gap-4 border-b border-line px-6 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.name}</p>
                  <p className="text-[13px] text-muted">
                    {KIND[d.kind]}
                    {locked ? ', já usa MSI pelo driver' : d.msi === null ? ', modo padrão do driver' : ''}
                  </p>
                </div>
                <Toggle label={`Modo MSI em ${d.name}`} on={!!d.msi} busy={busy === d.instanceId} disabled={locked || (d.kind === 'storage' && !!d.msi)} onToggle={() => toggle(d)} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function UsbCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    window.fps.invoke<boolean | null>('devices:usb-suspend').then(setEnabled)
  }, [])
  const toggle = async () => {
    setBusy(true)
    const next = !enabled
    const r = await window.fps.invoke<OpResult>('devices:set-usb-suspend', next)
    setBusy(false)
    if (r.ok) setEnabled(next)
    else toast.error(r.error ?? 'Não foi possível alterar.')
  }
  return (
    <section aria-labelledby="usb" className="card flex items-center gap-4 px-6 py-5">
      <div className="min-w-0 flex-1">
        <h2 id="usb" className="card-title">
          Suspensão seletiva do USB
        </h2>
        <p className="text-[13px] text-muted">
          Quando ligada, o Windows desliga portas USB ociosas para economizar energia, o que pode causar travadas em mouse e headset. Recomendado
          desligar em PCs de jogo.
        </p>
      </div>
      <Toggle label="Suspensão seletiva do USB" on={!!enabled} busy={busy} disabled={enabled === null} onToggle={toggle} />
    </section>
  )
}

function Slider({ label, hint, min, max, value, onChange }: { label: string; hint: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="font-semibold">{label}</span>
        <span className="num text-[15px]">{value}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-action)]" />
      <span className="text-[12.5px] text-muted">{hint}</span>
    </label>
  )
}

function InputCard() {
  const [p, setP] = useState<InputPrefs | null>(null)
  useEffect(() => {
    window.fps.invoke<InputPrefs>('devices:input').then(setP)
  }, [])

  const save = async (patch: Partial<InputPrefs>) => {
    if (!p) return
    setP({ ...p, ...patch })
    const r = await window.fps.invoke<OpResult>('devices:set-input', patch)
    if (!r.ok) toast.error(r.error ?? 'Não foi possível aplicar.')
  }

  return (
    <section aria-labelledby="input" className="card p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="input" className="card-title">
          Mouse e teclado
        </h2>
        <button className="btn btn-ghost btn-sm" disabled={!p} onClick={() => save({ mouseSpeed: 10, keyboardDelay: 1, keyboardSpeed: 31 })}>
          <RotateCcw size={13} /> Padrão do Windows
        </button>
      </div>
      {!p ? (
        <p className="text-muted">Lendo configurações…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Slider
              label="Velocidade do ponteiro"
              hint="10 é o valor 1:1 do Windows: um ponto do mouse vira um pixel. Ajuste a sensibilidade no jogo ou no DPI do mouse."
              min={1}
              max={20}
              value={p.mouseSpeed}
              onChange={(v) => save({ mouseSpeed: v })}
            />
            <Slider label="Atraso da repetição de tecla" hint="0 = 250 ms, 3 = 1 s. Menor responde mais rápido ao segurar uma tecla." min={0} max={3} value={p.keyboardDelay} onChange={(v) => save({ keyboardDelay: v })} />
            <Slider label="Velocidade da repetição" hint="31 é o mais rápido." min={0} max={31} value={p.keyboardSpeed} onChange={(v) => save({ keyboardSpeed: v })} />
          </div>
          <div className="flex flex-col gap-4 text-[14px]">
            <div>
              <p className="mb-1 flex items-center gap-2 font-semibold">
                <Mouse size={15} className="text-muted" /> Mouses conectados
              </p>
              {p.mice.length ? p.mice.map((m) => <p key={m} className="truncate text-muted">{m}</p>) : <p className="text-muted">Nenhum encontrado</p>}
            </div>
            <div>
              <p className="mb-1 flex items-center gap-2 font-semibold">
                <Keyboard size={15} className="text-muted" /> Teclados conectados
              </p>
              {p.keyboards.length ? p.keyboards.map((k) => <p key={k} className="truncate text-muted">{k}</p>) : <p className="text-muted">Nenhum encontrado</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export function Devices() {
  const [restart, setRestart] = useState(false)
  return (
    <>
      <PageHeader title="Dispositivos" lead="Ajustes de hardware que reduzem atraso de entrada: interrupções, USB, mouse e teclado." />
      {restart && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-[18px] border border-line bg-card px-5 py-3">
          <p>O modo MSI só muda depois de reiniciar o computador.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => window.fps.invoke('app:reboot')}>
            Reiniciar agora
          </button>
        </div>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <MsiCard onRestart={() => setRestart(true)} />
        <div className="flex flex-col gap-5">
          <UsbCard />
          <InputCard />
        </div>
      </div>
    </>
  )
}
