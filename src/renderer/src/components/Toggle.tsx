interface Props {
  on: boolean
  busy?: boolean
  disabled?: boolean
  label: string
  onToggle: () => void
}

/** On/off switch. While a script runs, the knob sits mid-track and pulses. */
export function Toggle({ on, busy, disabled, label, onToggle }: Props) {
  const pos = busy ? 'translate-x-[8px]' : on ? 'translate-x-[16px]' : 'translate-x-0'
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-busy={busy}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onToggle}
      className={`relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full p-[3px] transition-colors duration-150 disabled:cursor-not-allowed ${
        on ? 'bg-gradient-to-r from-primary to-violet shadow-[0_0_12px_-2px_rgb(59_130_246_/0.7)]' : 'bg-line hover:bg-[#2c3a6e]'
      } ${busy ? 'cursor-wait' : ''}`}
    >
      <span
        aria-hidden
        className={`block size-[16px] rounded-full bg-white transition-transform duration-200 ${pos} ${busy ? 'animate-pulse' : ''}`}
      />
    </button>
  )
}
