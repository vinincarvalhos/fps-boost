import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Minus, Square, X, ShieldAlert } from 'lucide-react'
import { NAV } from '../lib/nav'
import { Toasts } from './Toasts'

function TitleBar() {
  return (
    <header className="drag flex h-9 shrink-0 items-center justify-between bg-mask-deep pl-4">
      <span className="type-heading text-[13px] text-silk-dim">FpsBoost</span>
      <div className="no-drag flex h-full">
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
            className={`grid w-11 place-items-center text-silk-dim hover:text-silk ${
              ch === 'window:close' ? 'hover:bg-flux' : 'hover:bg-mask-raised'
            }`}
          >
            <Icon size={14} strokeWidth={1.75} />
          </button>
        ))}
      </div>
    </header>
  )
}

/** Navigation drawn as a card-edge connector: each item has a gold finger that goes solid when active. */
function EdgeConnector() {
  return (
    <nav aria-label="Seções" className="flex w-56 shrink-0 flex-col bg-mask-deep py-3">
      {NAV.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 py-2 pl-7 pr-4 text-[14px] transition-colors ${
              isActive ? 'text-silk' : item.phase > 1 ? 'text-silk-dim/60 hover:text-silk-dim' : 'text-silk-dim hover:text-silk'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                aria-hidden
                className={`absolute left-0 top-1/2 h-6 w-3 -translate-y-1/2 rounded-r-[2px] transition-colors ${
                  isActive ? 'bg-gold' : 'border border-l-0 border-gold/35 group-hover:border-gold/70'
                }`}
              />
              <item.icon size={17} strokeWidth={1.75} className={isActive ? 'text-gold' : ''} />
              <span style={{ fontVariationSettings: `'wdth' ${isActive ? 112 : 100}` }} className={isActive ? 'font-semibold' : ''}>
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function AdminNotice() {
  const [admin, setAdmin] = useState<boolean | null>(null)
  useEffect(() => {
    window.fps.invoke<boolean>('app:is-admin').then(setAdmin).catch(() => setAdmin(null))
  }, [])
  if (admin !== false) return null
  return (
    <div role="alert" className="flex items-center gap-3 border-b border-flux/40 bg-flux/10 px-8 py-2.5 text-[14px]">
      <ShieldAlert size={16} className="shrink-0 text-flux" />
      O FpsBoost está sem permissão de administrador, então os ajustes não vão funcionar. Feche e abra de novo com
      "Executar como administrador".
    </div>
  )
}

export function Shell() {
  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <EdgeConnector />
        <main className="pcb-surface min-w-0 flex-1 overflow-y-auto">
          <AdminNotice />
          <div className="mx-auto max-w-[1100px] px-10 pb-16 pt-10">
            <Outlet />
          </div>
        </main>
      </div>
      <Toasts />
    </div>
  )
}
