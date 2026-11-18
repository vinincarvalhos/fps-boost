import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, ExternalLink, HelpCircle, Info, Power, RefreshCw } from 'lucide-react'
import type { BiosCheck, BiosReport, OpResult } from '@shared/types'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { toast } from '../lib/toast'

const STATUS: Record<BiosCheck['status'], { icon: typeof Info; cls: string; label: string }> = {
  action: { icon: AlertCircle, cls: 'text-ram', label: 'Vale mudar' },
  ok: { icon: CheckCircle2, cls: 'text-up', label: 'Certo' },
  info: { icon: Info, cls: 'text-muted', label: 'Depende do uso' },
  unknown: { icon: HelpCircle, cls: 'text-muted', label: 'Não detectado' }
}

const ORDER: BiosCheck['status'][] = ['action', 'info', 'unknown', 'ok']

function KeysHelp({ vendor }: { vendor: string }) {
  const v = vendor.toLowerCase()
  const key = v.includes('asus') || v.includes('msi') || v.includes('micro-star') || v.includes('gigabyte') || v.includes('asrock') ? 'Del' : v.includes('lenovo') ? 'F1 ou F2' : v.includes('hp') ? 'Esc e depois F10' : v.includes('dell') || v.includes('acer') ? 'F2' : 'Del ou F2'
  return (
    <p className="text-[14px] text-muted-on-dark">
      Se o Windows não conseguir abrir a BIOS sozinho, reinicie e aperte <strong className="text-white">{key}</strong> repetidamente ao ligar.
    </p>
  )
}

export function Bios() {
  const [r, setR] = useState<BiosReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const load = async () => {
    setLoading(true)
    setR(await window.fps.invoke<BiosReport>('bios:report'))
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const reboot = async () => {
    setConfirm(false)
    const res = await window.fps.invoke<OpResult>('app:reboot-firmware')
    if (res.ok) toast.ok('Reiniciando na BIOS em 5 segundos')
    else toast.error(res.error || 'O Windows não conseguiu reiniciar direto na BIOS. Rode o FpsBoost como administrador.')
  }

  const checks = [...(r?.checks ?? [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))
  const todo = checks.filter((c) => c.status === 'action').length

  return (
    <>
      <PageHeader title="BIOS" lead="O que dá para melhorar na BIOS do seu PC, e onde fica cada opção. O FpsBoost só lê; nada é gravado na BIOS.">
        <button className="btn btn-ghost" disabled={loading} onClick={load}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Verificar de novo
        </button>
      </PageHeader>

      <section aria-labelledby="fw" className="tile-dark mb-6 flex flex-wrap items-end justify-between gap-6 px-10 py-9">
        <div className="min-w-0">
          <p className="text-[14px] text-muted-on-dark">{r ? (r.laptop ? 'Notebook' : 'Placa-mãe') : ''}</p>
          <h2 id="fw" className="mt-1 text-[34px] font-semibold leading-[1.1]">
            {r ? `${r.boardVendor} ${r.board}`.trim() : 'Lendo o firmware…'}
          </h2>
          <p className="mt-1 text-[15px] text-muted-on-dark">
            {r ? `BIOS ${r.version}${r.vendor ? ` (${r.vendor})` : ''}${r.date ? `, de ${new Date(r.date + 'T12:00').toLocaleDateString('pt-BR')}` : ''}` : ''}
          </p>
          <p className="mt-4 text-[21px] font-semibold">
            {!r ? '' : todo ? `${todo} ${todo === 1 ? 'ajuste vale a pena' : 'ajustes valem a pena'} na BIOS.` : 'Nada importante para mudar na BIOS.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-ghost" disabled={!r} onClick={() => window.fps.invoke('bios:open-support')}>
            Suporte do fabricante <ExternalLink size={14} />
          </button>
          <button className="btn btn-primary" onClick={() => setConfirm(true)}>
            <Power size={15} /> Reiniciar na BIOS
          </button>
        </div>
      </section>

      <section aria-labelledby="checks" className="card">
        <h2 id="checks" className="card-title border-b border-line px-6 py-4">
          Configurações para jogos
        </h2>
        {!r ? (
          <p className="px-6 py-6 text-muted">Lendo o que o Windows sabe sobre a BIOS…</p>
        ) : (
          <ul>
            {checks.map((c) => {
              const s = STATUS[c.status]
              return (
                <li key={c.id} className="flex items-start gap-4 border-b border-line px-6 py-4 last:border-b-0">
                  <s.icon size={20} className={`mt-0.5 shrink-0 ${s.cls}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {c.title}
                      <span className={`tag ${s.cls}`}>{s.label}</span>
                    </p>
                    <p className="mt-0.5 max-w-[80ch] text-muted">{c.detail}</p>
                    {c.howTo && <p className="mt-2 max-w-[80ch] rounded-[8px] bg-card-2 px-3 py-2 text-[14px]">{c.howTo}</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {confirm && (
        <Modal
          title="Reiniciar direto na BIOS?"
          onClose={() => setConfirm(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={reboot}>
                Reiniciar agora
              </button>
            </>
          }
        >
          <p>
            <strong>Salve o que estiver aberto.</strong> O computador reinicia em 5 segundos e abre a configuração da placa-mãe (UEFI).
          </p>
          <p>Para sair sem mudar nada, escolha "Exit without saving" (ou "Sair sem salvar") na BIOS.</p>
          <div className="tile-dark mt-3 rounded-[12px] p-4">
            <KeysHelp vendor={r?.boardVendor ?? ''} />
          </div>
        </Modal>
      )}
    </>
  )
}
