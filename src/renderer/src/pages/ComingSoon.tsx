import type { NavItem } from '../lib/nav'
import { PageHeader } from '../components/PageHeader'

export function ComingSoon({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader title={item.label} lead={item.summary} />
      <div className="ic flex max-w-[560px] items-center gap-5 px-6 py-5">
        <item.icon size={28} strokeWidth={1.5} className="shrink-0 text-gold" />
        <p className="text-silk-dim">Esta seção ainda não está pronta. Ela entra na etapa {item.phase} do desenvolvimento.</p>
      </div>
    </>
  )
}
