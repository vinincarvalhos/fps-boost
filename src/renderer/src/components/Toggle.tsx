interface Props {
  on: boolean
  busy?: boolean
  disabled?: boolean
  label: string
  onToggle: () => void
}

/** On/off switch in Action Blue. While a script runs, the knob sits mid-track and pulses. */
export function Toggle({ on, busy, disabled, label, onToggle }: Props) {
  const pos = busy ? 'translate-x-[9px]' : on ? 'translate-x-[18px]' : 'translate-x-0'
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-busy={busy}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onToggle}
      className={`relative h-[26px] w-[44px] shrink-0 cursor-pointer rounded-full p-[3px] transition-colors duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? 'bg-action' : 'bg-track'
      } ${busy ? 'cursor-wait' : ''}`}
    >
      <span
        aria-hidden
        className={`block size-[20px] rounded-full bg-white ring-1 ring-black/5 transition-transform duration-200 ${pos} ${busy ? 'animate-pulse' : ''}`}
      />
    </button>
  )
}
