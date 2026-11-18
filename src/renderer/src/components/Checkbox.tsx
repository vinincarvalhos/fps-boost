import { Check } from 'lucide-react'

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border-2 transition-colors disabled:opacity-40 ${
        checked ? 'border-action bg-action' : 'border-muted/60 hover:border-primary'
      }`}
    >
      {checked && <Check size={12} strokeWidth={3.5} className="text-white" />}
    </button>
  )
}
