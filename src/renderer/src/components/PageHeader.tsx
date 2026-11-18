import type { ReactNode } from 'react'

export function PageHeader({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-[60ch]">
        <h1 className="type-display text-[44px]">{title}</h1>
        {lead && <p className="mt-3 text-silk-dim">{lead}</p>}
      </div>
      {children && <div className="flex gap-3">{children}</div>}
    </div>
  )
}
