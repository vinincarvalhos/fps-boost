import type { ReactNode } from 'react'

export function PageHeader({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[34px] font-semibold leading-[1.1]">{title}</h1>
        {lead && <p className="mt-1.5 max-w-[70ch] text-[17px] leading-[1.4] text-muted">{lead}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  )
}
