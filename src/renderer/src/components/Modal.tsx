import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  onClose: () => void
  actions: ReactNode
  wide?: boolean
}

export function Modal({ title, children, onClose, actions, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto ${wide ? 'w-[760px]' : 'w-[520px]'} max-w-[92vw] rounded-[14px] border border-line bg-card p-0 text-ink backdrop:bg-black/50`}
    >
      <div className="px-6 pb-5 pt-5">
        <h2 className="text-[18px] font-semibold">{title}</h2>
        <div className="prose-ui mt-3 max-h-[50vh] overflow-y-auto text-muted">{children}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-6 py-3.5">{actions}</div>
    </dialog>
  )
}
