import { Link } from 'react-router-dom'
import type { NavItem } from '../lib/nav'
import { PageHeader } from '../components/PageHeader'

export function ComingSoon({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader title={item.label} lead={item.summary} />
      <div className="card flex max-w-[640px] items-start gap-4 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-card-2">
          <item.icon size={20} strokeWidth={1.75} className="text-primary" />
        </span>
        <div>
          <h2 className="font-semibold">Ainda não disponível</h2>
          <p className="mt-1 text-muted">
            Esta seção chega numa próxima versão. Enquanto isso, os ajustes de desempenho já estão prontos para usar.
          </p>
          <Link to="/tweaks" className="btn btn-ghost btn-sm mt-3">
            Abrir ajustes
          </Link>
        </div>
      </div>
    </>
  )
}
