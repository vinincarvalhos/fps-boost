import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ArrowDownToLine, Crown, Minus, Search, ShieldAlert, ShieldCheck, Square, X } from 'lucide-react'
import { startAccountSync, useAccount } from '../lib/account'
import { Upsell } from './Upsell'
import { NAV_GROUPS } from '../lib/nav'
import { startLivePolling, useLive } from '../lib/live'
import { Logo } from './Logo'
import { Toasts } from './Toasts'

function WindowButtons() {
  return (
    <div className="no-drag -mr-2 flex h-full">
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
          className={`grid w-10 place-items-center rounded-[8px] text-muted hover:text-ink ${ch === 'window:close' ? 'hover:bg-danger' : 'hover:bg-card-2'}`}
        >
          <Icon size={14} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  )
}

function Sidebar() {
  return (
    <nav aria-label="Seções" className="flex w-[252px] shrink-0 flex-col overflow-y-auto border-r border-line bg-bg-2/70 px-4 pb-4 backdrop-blur">
      <div className="drag flex h-[68px] shrink-0 items-center px-1.5">
        <Logo />
      </div>
      {NAV_GROUPS.map((g) => (
        <div key={g.label} className="mt-3 first:mt-1">
          <p className="mb-1.5 px-3 text-[12px] font-medium text-muted/80">{g.label}</p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex h-[34px] items-center gap-3 rounded-[10px] px-3 transition-colors ${
                      isActive
                        ? 'bg-gradient-to-r from-primary to-[#4f6ef7] font-medium text-white shadow-[0_6px_18px_-6px_rgb(59_130_246_/0.8)]'
                        : 'text-muted hover:bg-card-2/70 hover:text-ink'
                    }`
                  }
                >
                  <item.icon size={17} strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.phase > 1 && <span aria-label="em breve" title="Em breve" className="size-1.5 shrink-0 rounded-full bg-muted/50" />}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function TopBar() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [admin, setAdmin] = useState<boolean | null>(null)
  const user = useLive((s) => s.info?.os.user)

  useEffect(() => {
    window.fps.invoke<boolean>('app:is-admin').then(setAdmin).catch(() => setAdmin(null))
  }, [])

  return (
    <header className="drag flex h-[68px] shrink-0 items-center gap-3 px-7">
      <form
        className="no-drag relative w-[340px] max-w-full"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          navigate(`/tweaks${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
        }}
      >
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <label htmlFor="global-search" className="sr-only">
          Buscar ajustes
        </label>
        <input
          id="global-search"
          className="field w-full rounded-[12px] bg-card/80 pl-10"
          placeholder="Buscar ajustes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      <div className="flex-1" />
      <UpdatePill />
      <PlanBadge />
      {admin != null && (
        <span
          className={`no-drag inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium ${
            admin ? 'border-up/30 bg-up/10 text-up' : 'border-danger/40 bg-danger/10 text-[#f87171]'
          }`}
          title={admin ? 'Os ajustes podem ser aplicados' : 'Abra o FpsBoost com "Executar como administrador"'}
        >
          {admin ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          {admin ? 'Administrador' : 'Sem administrador'}
        </span>
      )}
      {user && (
        <span
          className="no-drag grid size-9 place-items-center rounded-full bg-gradient-to-br from-[#38bdf8] to-violet text-[13px] font-semibold text-white"
          title={user}
        >
          {user.slice(0, 2).toUpperCase()}
        </span>
      )}
      <WindowButtons />
    </header>
  )
}

/** Plan badge in the top bar; links to the License page. */
function PlanBadge() {
  const premium = useAccount((s) => s.license.plan === 'premium')
  return (
    <Link
      to="/license"
      className={`no-drag inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ${
        premium
          ? 'bg-gradient-to-r from-primary to-violet text-white shadow-[0_4px_14px_-4px_rgb(139_92_246_/0.8)]'
          : 'border border-line bg-card/70 text-muted hover:text-ink'
      }`}
    >
      <Crown size={13} />
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
    <Link to="/settings" className="no-drag inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/50 bg-primary/15 px-3 text-[12.5px] font-medium text-[#93c5fd]">
      <ArrowDownToLine size={13} />
      {label}
    </Link>
  )
}

export function AdminNotice() {
  const [admin, setAdmin] = useState<boolean | null>(null)
  useEffect(() => {
    window.fps.invoke<boolean>('app:is-admin').then(setAdmin).catch(() => setAdmin(null))
  }, [])
  if (admin !== false) return null
  return (
    <div role="alert" className="mb-5 flex items-center gap-3 rounded-[12px] border border-danger/40 bg-danger/10 px-4 py-2.5">
      <ShieldAlert size={16} className="shrink-0 text-[#f87171]" />
      <p>Sem permissão de administrador: os ajustes não vão funcionar. Feche o FpsBoost e abra com "Executar como administrador".</p>
    </div>
  )
}

export function Shell() {
  useEffect(() => {
    startLivePolling()
    startAccountSync()
  }, [])
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto px-7 pb-10 pt-1">
          <Outlet />
        </main>
      </div>
      <Toasts />
      <Upsell />
    </div>
  )
}
