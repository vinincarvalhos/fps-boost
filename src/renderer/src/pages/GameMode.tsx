import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Crown, Gamepad2, Power, Radar } from 'lucide-react'
import type { GameModePrefs, GameModeState } from '@shared/types'
import { Checkbox } from '../components/Checkbox'
import { PageHeader } from '../components/PageHeader'
import { Toggle } from '../components/Toggle'
import { useAccount, usePremium } from '../lib/account'
import { toast } from '../lib/toast'

interface ServiceInfo {
  name: string
  label: string
  description: string
}

const ACTIONS: { key: Exclude<keyof GameModePrefs, 'autoActivate' | 'services'>; title: string; text: string }[] = [
  { key: 'powerPlan', title: 'Plano de energia de alto desempenho', text: 'Usa o Desempenho Máximo (se você aplicou esse ajuste) ou o Alto Desempenho. O plano anterior volta ao sair.' },
  { key: 'timerResolution', title: 'Timer do sistema em 0,5 ms', text: 'Agenda o trabalho do jogo com mais precisão, reduzindo variação no tempo de quadro.' },
  { key: 'freeRam', title: 'Liberar memória RAM', text: 'Se a RAM estiver quase cheia quando o jogo abre, esvazia a memória ociosa dos outros programas. O jogo não é mexido.' },
  { key: 'raisePriority', title: 'Prioridade maior para o jogo', text: 'O jogo fica acima do normal, na frente dos programas em segundo plano, sem tirar CPU do som e do mouse.' },
  { key: 'stopServices', title: 'Pausar serviços em segundo plano', text: 'Os serviços marcados abaixo param enquanto você joga e voltam ao sair.' }
]

function since(iso?: string): string {
  if (!iso) return ''
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  return min < 1 ? 'agora há pouco' : min < 60 ? `há ${min} min` : `há ${Math.floor(min / 60)} h ${min % 60} min`
}

export function GameMode() {
  const premium = usePremium()
  const openUpsell = useAccount((s) => s.openUpsell)
  const [state, setState] = useState<GameModeState | null>(null)
  const [prefs, setPrefs] = useState<GameModePrefs | null>(null)
  const [services, setServices] = useState<ServiceInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)

  useEffect(() => {
    window.fps.invoke<GameModeState>('gamemode:state').then(setState)
    window.fps.invoke<GameModePrefs>('gamemode:prefs').then(setPrefs)
    window.fps.invoke<ServiceInfo[]>('gamemode:services').then(setServices)
    const off = window.fps.on<GameModeState>('gamemode:changed', setState)
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => {
      off()
      clearInterval(t)
    }
  }, [])

  const save = async (patch: Partial<GameModePrefs>) => setPrefs(await window.fps.invoke<GameModePrefs>('gamemode:set-prefs', patch))

  const toggleActive = async () => {
    if (!premium) return openUpsell()
    setBusy(true)
    const s = await window.fps.invoke<GameModeState>(state?.active ? 'gamemode:deactivate' : 'gamemode:activate')
    setBusy(false)
    setState(s)
    if (s.error) toast.error(s.error)
    else toast.ok(s.active ? 'Modo jogo ativado' : 'Modo jogo desativado; tudo voltou ao normal')
  }

  const active = !!state?.active

  return (
    <>
      <PageHeader title="Modo jogo" lead="Um perfil de desempenho que liga sozinho quando um jogo da sua Biblioteca abre, e desfaz tudo quando ele fecha." />

      {!premium && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[18px] border border-line bg-card px-5 py-3.5">
          <Crown size={18} className="shrink-0 text-ink" />
          <p className="flex-1">O Modo jogo faz parte do plano Premium. Você pode configurar tudo agora e ativar quando tiver uma chave.</p>
          <Link to="/license" className="btn btn-primary btn-sm">
            Ativar chave
          </Link>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* status */}
        <section aria-labelledby="status" className={`overflow-hidden ${active ? 'tile-dark' : 'card'}`}>
          <div className="relative p-7">
            <div className="flex flex-wrap items-center gap-4">
              <span
                className={`grid size-14 shrink-0 place-items-center rounded-[16px] ${
                  active ? 'bg-white text-[#1d1d1f]' : 'bg-card-2 text-ink'
                }`}
              >
                <Gamepad2 size={26} />
              </span>
              <div className="min-w-[200px] flex-1">
                <h2 id="status" className="whitespace-nowrap text-[24px] font-semibold">
                  {active ? 'Modo jogo ativo' : 'Modo jogo desligado'}
                </h2>
                <p className={active ? 'text-muted-on-dark' : 'text-muted'}>
                  {active
                    ? `${state?.game ? state.game.name : 'Ativado manualmente'}, ${since(state?.since)}`
                    : prefs?.autoActivate
                      ? 'Aguardando um jogo da Biblioteca abrir'
                      : 'Ative manualmente ou ligue a detecção automática'}
                </p>
              </div>
              <button className={active ? 'btn btn-ghost' : 'btn btn-primary'} disabled={busy} onClick={toggleActive}>
                {!premium ? <Crown size={15} /> : <Power size={15} />}
                {busy ? 'Aguarde…' : active ? 'Desativar' : 'Ativar agora'}
              </button>
            </div>

            {active && state && state.applied.length > 0 && (
              <ul className="mt-5 grid gap-1.5 sm:grid-cols-2">
                {state.applied.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-[13.5px]">
                    <CheckCircle2 size={15} className="shrink-0 text-[#30d158]" /> {a}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`flex items-center gap-4 border-t px-7 py-4 ${active ? 'border-white/10' : 'border-line'}`}>
            <span className={`grid size-9 shrink-0 place-items-center rounded-full ${active ? 'bg-white/10 text-white' : 'bg-card-2 text-primary'}`}>
              <Radar size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Ativar automaticamente</p>
              <p className={`text-[13px] ${active ? 'text-muted-on-dark' : 'text-muted'}`}>
                Verifica a cada 5 segundos se algum jogo da <Link to="/games" className={`${active ? 'text-sky' : 'text-primary'} hover:underline`}>Biblioteca</Link> está aberto.
              </p>
            </div>
            <Toggle label="Ativar automaticamente" on={!!prefs?.autoActivate} disabled={!prefs} onToggle={() => save({ autoActivate: !prefs?.autoActivate })} />
          </div>
        </section>

        {/* actions */}
        <section aria-labelledby="actions" className="card">
          <h2 id="actions" className="card-title border-b border-line px-5 py-3.5">
            O que o Modo jogo faz
          </h2>
          <ul>
            {ACTIONS.map((a) => (
              <li key={a.key} className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-[12.5px] text-muted">{a.text}</p>
                </div>
                <Toggle label={a.title} on={!!prefs?.[a.key]} disabled={!prefs || active} onToggle={() => save({ [a.key]: !prefs?.[a.key] })} />
              </li>
            ))}
          </ul>
          {prefs?.stopServices && (
            <div className="border-t border-line bg-card-2 px-5 py-3.5">
              <p className="mb-2 text-[13px] font-medium text-muted">Serviços pausados</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {services.map((s) => (
                  <li key={s.name} className="flex items-start gap-2.5">
                    <Checkbox
                      label={s.label}
                      checked={prefs.services.includes(s.name)}
                      disabled={active}
                      onChange={(v) => save({ services: v ? [...prefs.services, s.name] : prefs.services.filter((x) => x !== s.name) })}
                    />
                    <div className="min-w-0">
                      <p className="text-[13.5px] leading-tight">{s.label}</p>
                      <p className="text-[12px] text-muted">{s.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {active && <p className="border-t border-line px-5 py-2.5 text-[12.5px] text-muted">Desative o Modo jogo para mudar estas opções.</p>}
        </section>
      </div>
    </>
  )
}
