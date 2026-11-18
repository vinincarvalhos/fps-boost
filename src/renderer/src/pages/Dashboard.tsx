import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LiveStats, SystemInfo, TweakMeta } from '@shared/types'
import { Board } from '../components/Board'

function useLive(intervalMs = 1500): LiveStats | null {
  const [live, setLive] = useState<LiveStats | null>(null)
  useEffect(() => {
    // Chained timeouts, not setInterval: a slow reading never stacks up behind another.
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const s = await window.fps.invoke<LiveStats>('system:live')
        if (alive) setLive(s)
      } catch {
        /* keep last reading */
      }
      if (alive) timer = setTimeout(tick, intervalMs)
    }
    tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [intervalMs])
  return live
}

export function Dashboard() {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const live = useLive()

  useEffect(() => {
    window.fps.invoke<SystemInfo>('system:info').then(setInfo)
    Promise.all([
      window.fps.invoke<TweakMeta[]>('tweaks:list'),
      window.fps.invoke<Record<string, boolean>>('tweaks:states')
    ]).then(([list, states]) => setPending(list.filter((t) => t.recommended && !states[t.id]).length))
  }, [])

  const greeting = info ? `Olá, ${info.os.user}` : 'Lendo sua máquina…'

  return (
    <>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="type-display text-[44px]">{greeting}</h1>
        <p className="text-silk-dim">{info ? `${info.board.manufacturer} ${info.board.model}`.trim() : ''}</p>
      </div>

      <Board info={info} live={live} />

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_auto] md:items-center">
        <div className="max-w-[58ch]">
          <h2 className="type-heading text-[22px]">
            {pending == null
              ? 'Verificando ajustes…'
              : pending === 0
                ? 'Todos os ajustes recomendados estão ativos'
                : `${pending} ${pending === 1 ? 'ajuste recomendado ainda está desligado' : 'ajustes recomendados ainda estão desligados'}`}
          </h2>
          <p className="mt-2 text-silk-dim">
            Cada ajuste mostra o que muda antes de aplicar e pode ser revertido depois. Um ponto de restauração é criado
            automaticamente antes do primeiro.
          </p>
        </div>
        <Link to="/tweaks" className="btn btn-gold justify-self-start">
          Abrir ajustes
        </Link>
      </div>
    </>
  )
}
