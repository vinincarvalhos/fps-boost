import { ArrowDownToLine, RefreshCw, RotateCcw } from 'lucide-react'
import type { UpdaterState } from '@shared/types'
import { useAccount } from '../lib/account'

const when = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')

function describe(u: UpdaterState): string {
  switch (u.status) {
    case 'dev':
      return 'Atualizações só funcionam na versão instalada pelo instalador.'
    case 'checking':
      return 'Procurando atualizações…'
    case 'available':
      return `A versão ${u.version} está disponível.`
    case 'not-available':
      return `Você está na versão mais recente${u.checkedAt ? ` (verificado às ${when(u.checkedAt)})` : ''}.`
    case 'downloading':
      return `Baixando a versão ${u.version}… ${u.percent ?? 0}%`
    case 'downloaded':
      return `A versão ${u.version} foi baixada. Reinicie para instalar.`
    case 'error':
      return u.error ?? 'Não foi possível verificar atualizações.'
    default:
      return 'O FpsBoost procura atualizações ao abrir e a cada 6 horas.'
  }
}

export function UpdatesCard() {
  const u = useAccount((s) => s.updater)
  if (!u) return null
  const set = (p: Promise<UpdaterState>) => p.then((updater) => useAccount.setState({ updater }))
  return (
    <section aria-labelledby="updates" className="card">
      <h2 id="updates" className="border-b border-line px-4 py-3 font-semibold">
        Atualizações
      </h2>
      <div className="flex flex-wrap items-center gap-4 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="font-medium">FpsBoost {u.currentVersion}</p>
          <p className={`text-[13px] ${u.status === 'error' ? 'text-danger' : 'text-muted'}`}>{describe(u)}</p>
          {u.status === 'downloading' && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-action transition-[width]" style={{ width: `${u.percent ?? 0}%` }} />
            </div>
          )}
        </div>
        {u.status === 'available' ? (
          <button className="btn btn-primary btn-sm" onClick={() => set(window.fps.invoke<UpdaterState>('updater:download'))}>
            <ArrowDownToLine size={14} /> Baixar {u.version}
          </button>
        ) : u.status === 'downloaded' ? (
          <button className="btn btn-primary btn-sm" onClick={() => window.fps.invoke('updater:install')}>
            <RotateCcw size={14} /> Reiniciar e instalar
          </button>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            disabled={u.status === 'dev' || u.status === 'checking' || u.status === 'downloading'}
            onClick={() => set(window.fps.invoke<UpdaterState>('updater:check'))}
          >
            <RefreshCw size={14} className={u.status === 'checking' ? 'animate-spin' : ''} /> Procurar atualizações
          </button>
        )}
      </div>
      {u.status === 'available' && u.releaseNotes && (
        <p className="whitespace-pre-line border-t border-line px-4 py-3 text-[13px] text-muted">{u.releaseNotes.slice(0, 600)}</p>
      )}
    </section>
  )
}
