import { X } from 'lucide-react'
import { useToasts } from '../lib/toast'

export function Toasts() {
  const { toasts, dismiss } = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-96 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-chip border bg-mask-deep px-4 py-3 text-[14px] ${
            t.kind === 'error' ? 'border-flux' : 'border-gold'
          }`}
        >
          <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${t.kind === 'error' ? 'bg-flux' : 'bg-gold'}`} />
          <p className="flex-1 whitespace-pre-line">{t.text}</p>
          <button aria-label="Fechar aviso" onClick={() => dismiss(t.id)} className="text-silk-dim hover:text-silk">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
