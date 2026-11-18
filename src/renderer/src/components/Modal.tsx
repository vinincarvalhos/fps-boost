import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  onClose: () => void
  actions: ReactNode
}

export function Modal({ title, children, onClose, actions }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[560px] max-w-[92vw] rounded-chip border border-gold/60 bg-mask p-0 text-silk backdrop:bg-mask-deep/80"
    >
      <div className="p-7">
        <h2 className="type-heading text-[24px]">{title}</h2>
        <div className="prose-silk mt-4 max-h-[50vh] overflow-y-auto pr-2 text-[15px] text-silk-dim">{children}</div>
      </div>
      <div className="flex justify-end gap-3 border-t border-mask-line bg-mask-deep px-7 py-4">{actions}</div>
    </dialog>
  )
}
