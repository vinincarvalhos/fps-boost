interface Props {
  on: boolean
  busy?: boolean
  disabled?: boolean
  label: string
  onToggle: () => void
}

/**
 * A DIP switch: a recessed housing with a lever that slides and seats on a gold contact.
 * While a script runs the lever sits mid-travel.
 */
export function DipSwitch({ on, busy, disabled, label, onToggle }: Props) {
  const pos = busy ? 'translate-x-[9px]' : on ? 'translate-x-[18px]' : 'translate-x-0'
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-busy={busy}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onToggle}
      className="group relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-[3px] border border-mask-line bg-mask-deep p-[3px] disabled:cursor-wait"
    >
      {/* contact pad the lever seats on */}
      <span
        aria-hidden
        className={`absolute inset-y-[3px] right-[3px] w-[19px] rounded-[2px] transition-colors duration-150 ${
          on ? 'bg-gold/30' : 'bg-transparent'
        }`}
      />
      <span
        aria-hidden
        className={`relative block h-full w-[19px] rounded-[2px] transition-transform duration-200 ease-[cubic-bezier(.3,1.4,.5,1)] ${pos} ${
          on ? 'bg-gold' : 'bg-silk-dim group-hover:bg-silk'
        } ${busy ? 'animate-pulse' : ''}`}
      >
        {/* grip ridges */}
        <span className="absolute inset-x-[5px] top-1/2 h-[7px] -translate-y-1/2 border-y border-mask-deep/40" />
      </span>
    </button>
  )
}
