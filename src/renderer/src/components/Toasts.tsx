import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { useToasts } from '../lib/toast'

export function Toasts() {
  const { toasts, dismiss } = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[360px] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-start gap-2.5 rounded-[14px] bg-tile px-4 py-3 text-on-dark">
          {t.kind === 'error' ? (
            <CircleAlert size={16} className="mt-0.5 shrink-0 text-danger" />
          ) : (
            <CircleCheck size={16} className="mt-0.5 shrink-0 text-up" />
          )}
          <p className="flex-1 whitespace-pre-line">{t.text}</p>
          <button aria-label="Fechar aviso" onClick={() => dismiss(t.id)} className="text-muted-on-dark hover:text-white">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
