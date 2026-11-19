import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ArrowDownToLine, Crown, Minus, Moon, Search, ShieldAlert, ShieldCheck, Square, Sun, X } from 'lucide-react'
import { isDark, useTheme } from '../lib/theme'
import { startAccountSync, useAccount } from '../lib/account'
import { NAV_GROUPS } from '../lib/nav'
import { startLivePolling, useLive } from '../lib/live'
import { LogoMark } from './Logo'
import { Toasts } from './Toasts'
import { Upsell } from './Upsell'

function WindowButtons() {
  return (
    <div className="no-drag -mr-3 flex h-full">
      {(
        [
          ['window:minimize', Minus, 'Minimizar'],
          ['window:maximize', Square, 'Maximizar'],
          ['window:close', X, 'Fechar']
        ] as const
      ).map(([ch, Icon, label]) => (
        <button
          key={ch}
          aria-label={label}
          onClick={() => window.fps.send(ch)}
          className={`grid w-11 place-items-center text-muted-on-dark hover:text-white ${ch === 'window:close' ? 'hover:bg-danger' : 'hover:bg-white/15'}`}
        >
          <Icon size={13} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  )
}

/** Small capsule used in the global nav (plan, admin, update). */
const navChip = 'no-drag inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12px]'

function PlanBadge() {
  const premium = useAccount((s) => s.license.plan === 'premium')
  return (
    <Link to="/license" className={`${navChip} ${premium ? 'bg-white text-[#1d1d1f]' : 'bg-white/12 text-muted-on-dark hover:text-white'}`}>
      <Crown size={12} />
      {premium ? 'Premium' : 'Grátis'}
    </Link>
  )
}

/** Appears only when there is an update to download or install. */
function UpdatePill() {
  const u = useAccount((s) => s.updater)
  if (!u || !['available', 'downloading', 'downloaded'].includes(u.status)) return null
  const label = u.status === 'downloaded' ? 'Reiniciar para atualizar' : u.status === 'downloading' ? `Baixando ${u.percent ?? 0}%` : `Versão ${u.version} disponível`
  return (
    <Link to="/settings" className={`${navChip} bg-action text-white`}>
      <ArrowDownToLine size={12} />
      {label}
    </Link>
  )
}

/** Switches between light and night mode (an explicit choice; "Automático" lives in Configurações). */
function ThemeButton() {
  const set = useTheme((s) => s.set)
  const [dark, setDark] = useState(isDark())
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return (
    <button
      className="no-drag grid size-[26px] place-items-center rounded-full text-muted-on-dark hover:bg-white/15 hover:text-white"
      aria-label={dark ? 'Usar modo claro' : 'Usar modo noturno'}
      title={dark ? 'Modo claro' : 'Modo noturno'}
      onClick={() => set(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}

/** global-nav: the thin black bar across the top of the window. */
function GlobalNav() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [admin, setAdmin] = useState<boolean | null>(null)
  const user = useLive((s) => s.info?.os.user)

  useEffect(() => {
    window.fps.invoke<boolean>('app:is-admin').then(setAdmin).catch(() => setAdmin(null))
  }, [])

  return (
    <header className="drag flex h-11 shrink-0 items-center gap-3 bg-nav pl-4 pr-3 text-[12px] text-on-dark">
      <Link to="/" className="no-drag flex w-[216px] shrink-0 items-center gap-2" aria-label="FpsBoost, ir para a Visão geral">
        <LogoMark size={20} />
        <span className="text-[14px] font-semibold tracking-[-0.016em]">FpsBoost</span>
      </Link>
      <form
        className="no-drag relative w-[300px] max-w-full"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          navigate(`/tweaks${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
        }}
      >
        <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-on-dark" />
        <label htmlFor="global-search" className="sr-only">
          Buscar ajustes
        </label>
        <input
          id="global-search"
          className="h-[28px] w-full rounded-full bg-white/12 pl-8 pr-3 text-[12.5px] text-white placeholder:text-muted-on-dark focus:bg-white/20 focus:outline-none"
          placeholder="Buscar ajustes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      <div className="flex-1" />
      <UpdatePill />
      <ThemeButton />
      <PlanBadge />
      {admin != null && (
        <span
          className={`${navChip} ${admin ? 'bg-white/12 text-muted-on-dark' : 'bg-danger text-white'}`}
          title={admin ? 'Os ajustes podem ser aplicados' : 'Abra o FpsBoost com "Executar como administrador"'}
        >
          {admin ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
          {admin ? 'Administrador' : 'Sem administrador'}
        </span>
      )}
      {user && (
        <span className="no-drag grid size-[26px] place-items-center rounded-full bg-white/15 text-[11px] font-semibold" title={user}>
          {user.slice(0, 2).toUpperCase()}
        </span>
      )}
      <WindowButtons />
    </header>
  )
}

function Sidebar() {
  return (
    <nav aria-label="Seções" className="flex w-[232px] shrink-0 flex-col overflow-y-auto border-r border-line bg-bg-2 px-3 pb-4 pt-3">
      {NAV_GROUPS.map((g) => (
        <div key={g.label} className="mt-4 first:mt-0">
          <p className="mb-1 px-3 text-[12px] font-semibold text-muted">{g.label}</p>
          <ul className="flex flex-col">
            {g.items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex h-8 items-center gap-2.5 rounded-[8px] px-3 text-[14px] ${isActive ? 'bg-card-2 font-semibold text-ink' : 'text-ink/80 hover:bg-card-2/70'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={16} strokeWidth={1.75} className={isActive ? 'text-primary' : 'text-muted'} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {(item.note || item.phase > 1) && <span className="shrink-0 text-[11px] text-muted">{item.note ?? 'Em breve'}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function AdminNotice() {
  const [admin, setAdmin] = useState<boolean | null>(null)
  useEffect(() => {
    window.fps.invoke<boolean>('app:is-admin').then(setAdmin).catch(() => setAdmin(null))
  }, [])
  if (admin !== false) return null
  return (
    <div role="alert" className="mb-5 flex items-center gap-3 rounded-[18px] border border-danger/30 bg-card px-5 py-3">
      <ShieldAlert size={17} className="shrink-0 text-danger" />
      <p>Sem permissão de administrador: os ajustes não vão funcionar. Feche o FpsBoost e abra com "Executar como administrador".</p>
    </div>
  )
}

export function Shell() {
  useEffect(() => {
    startLivePolling()
    startAccountSync()
    useTheme.getState().load()
  }, [])
  return (
    <div className="flex h-full flex-col">
      <GlobalNav />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto px-8 pb-12 pt-7">
          <div className="mx-auto max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
      <Toasts />
      <Upsell />
    </div>
  )
}
