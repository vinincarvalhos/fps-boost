import { useState } from 'react'
import { Check, Crown, KeyRound, RefreshCw, WifiOff } from 'lucide-react'
import type { LicenseState } from '@shared/types'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { PREMIUM_BENEFITS } from '../components/Upsell'
import { useAccount } from '../lib/account'
import { toast } from '../lib/toast'

const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : null)

const STATUS: Record<LicenseState['status'], { label: string; cls: string }> = {
  none: { label: 'Plano grátis', cls: 'bg-white/5 text-muted' },
  active: { label: 'Ativa', cls: 'bg-up/15 text-up' },
  offline: { label: 'Ativa, sem conexão', cls: 'bg-ram/15 text-ram' },
  lapsed: { label: 'Precisa revalidar', cls: 'bg-ram/15 text-ram' },
  error: { label: 'Recusada', cls: 'bg-danger/15 text-[#f87171]' }
}

const FREE = ['Painel em tempo real', 'Ajustes seguros, um a um', 'Pontos de restauração e cópias do registro']

export function License() {
  const { license, activate, deactivate } = useAccount()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const premium = license.plan === 'premium'
  const st = STATUS[license.status]

  const submit = async () => {
    setBusy(true)
    const res = await activate(key)
    setBusy(false)
    if (res.ok) {
      toast.ok('Licença Premium ativada neste computador')
      setKey('')
    } else toast.error(res.error ?? 'A chave não foi ativada.')
  }

  const refresh = async () => {
    setBusy(true)
    const s = await window.fps.invoke<LicenseState>('license:refresh')
    useAccount.setState({ license: s })
    setBusy(false)
    if (s.status === 'active') toast.ok('Licença revalidada')
    else if (s.message) toast.error(s.message)
  }

  return (
    <>
      <PageHeader title="Licença" lead="Ative sua chave para liberar os recursos Premium neste computador." />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="lic" className="card overflow-hidden">
          <div className="flex items-center gap-4 border-b border-line p-5">
            <span className={`grid size-12 shrink-0 place-items-center rounded-[12px] ${premium ? 'bg-gradient-to-br from-[#38bdf8] via-primary to-violet text-white' : 'bg-card-2 text-muted'}`}>
              <Crown size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="lic" className="text-[20px] font-bold">
                {premium ? 'FpsBoost Premium' : 'FpsBoost Grátis'}
              </h2>
              <p className="text-muted">{license.maskedKey ?? 'Nenhuma chave ativada'}</p>
            </div>
            <span className={`tag h-7 px-3 text-[12.5px] ${st.cls}`}>{st.label}</span>
          </div>

          {license.maskedKey && (
            <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 [&>div]:bg-card [&>div]:px-5 [&>div]:py-3.5">
              <div>
                <dt className="text-[12px] text-muted">Computadores</dt>
                <dd className="num mt-0.5 text-[18px] font-bold">
                  {license.machinesUsed ?? '—'}
                  <span className="text-muted">/{license.maxMachines ?? '—'}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Validade da chave</dt>
                <dd className="mt-0.5 font-semibold">{date(license.licenseExpiresAt) ?? 'Sem vencimento'}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Funciona offline até</dt>
                <dd className="mt-0.5 font-semibold">{date(license.validUntil) ?? '—'}</dd>
              </div>
            </dl>
          )}

          {license.message && license.status !== 'active' && (
            <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-ram">
              <WifiOff size={15} className="shrink-0" /> {license.message}
            </p>
          )}

          <div className="border-t border-line p-5">
            {premium || license.status === 'offline' || license.status === 'lapsed' ? (
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-ghost" disabled={busy} onClick={refresh}>
                  <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> Revalidar agora
                </button>
                <button className="btn btn-danger" disabled={busy} onClick={() => setConfirmOff(true)}>
                  Desativar neste PC
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  submit()
                }}
              >
                <label htmlFor="key" className="mb-2 block font-medium">
                  Chave de licença
                </label>
                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-[260px] flex-1">
                    <KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      id="key"
                      className="field w-full pl-10 font-[family-name:var(--font-display)] tracking-wider uppercase"
                      placeholder="FPSB-XXXXX-XXXXX-XXXXX-XXXXX"
                      autoComplete="off"
                      spellCheck={false}
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary" disabled={busy || key.replace(/[^a-z0-9]/gi, '').length < 20}>
                    {busy ? 'Ativando…' : 'Ativar'}
                  </button>
                </div>
                <p className="mt-2 text-[13px] text-muted">A chave fica presa a este computador. Para trocar de PC, desative aqui primeiro.</p>
              </form>
            )}
          </div>
        </section>

        <section aria-labelledby="plans" className="card p-5">
          <h2 id="plans" className="card-title mb-4">
            O que cada plano inclui
          </h2>
          <h3 className="mb-2 text-[13px] font-semibold text-muted">Grátis</h3>
          <ul className="mb-5 flex flex-col gap-1.5">
            {FREE.map((f) => (
              <li key={f} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-muted" /> {f}
              </li>
            ))}
          </ul>
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-primary">
            <Crown size={14} /> Premium
          </h3>
          <ul className="flex flex-col gap-1.5">
            {['Tudo do plano grátis', ...PREMIUM_BENEFITS].map((f) => (
              <li key={f} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-up" /> {f}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {confirmOff && (
        <Modal
          title="Desativar a licença neste PC?"
          onClose={() => setConfirmOff(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmOff(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  setConfirmOff(false)
                  setBusy(true)
                  const res = await deactivate()
                  setBusy(false)
                  if (res.ok) toast.ok('Licença desativada. A vaga ficou livre para outro computador.')
                  else toast.error(res.error ?? 'Não foi possível desativar.')
                }}
              >
                Desativar
              </button>
            </>
          }
        >
          <p>
            Este computador volta para o plano grátis e libera uma vaga na sua chave. Ajustes Premium já aplicados continuam
            aplicados; você pode revertê-los a qualquer momento.
          </p>
        </Modal>
      )}
    </>
  )
}
