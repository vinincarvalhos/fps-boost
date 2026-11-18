import { useEffect, useState } from 'react'
import type { Settings as SettingsT } from '@shared/types'
import { DipSwitch } from '../components/DipSwitch'
import { PageHeader } from '../components/PageHeader'
import { toast } from '../lib/toast'

const OPTIONS: { key: keyof SettingsT; title: string; text: string }[] = [
  { key: 'autostart', title: 'Abrir com o Windows', text: 'O FpsBoost inicia minimizado quando você entra no Windows.' },
  { key: 'tray', title: 'Manter na bandeja', text: 'Fechar a janela deixa o FpsBoost rodando ao lado do relógio.' },
  {
    key: 'autoRestorePoint',
    title: 'Ponto de restauração automático',
    text: 'Cria um ponto de restauração antes do primeiro ajuste aplicado.'
  }
]

export function Settings() {
  const [s, setS] = useState<SettingsT | null>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.fps.invoke<SettingsT>('settings:get').then(setS)
    window.fps.invoke<string>('app:version').then(setVersion)
  }, [])

  const set = async (patch: Partial<SettingsT>) => setS(await window.fps.invoke<SettingsT>('settings:set', patch))

  const action = async (channel: 'app:restart-explorer' | 'app:reboot-firmware', okText: string) => {
    const res = await window.fps.invoke<{ ok: boolean; error?: string }>(channel)
    if (res.ok) toast.ok(okText)
    else toast.error(res.error || 'Não foi possível concluir.')
  }

  return (
    <>
      <PageHeader title="Configurações" lead={version ? `FpsBoost ${version}` : undefined} />

      <ul className="mb-14 max-w-[720px]">
        {OPTIONS.map((o) => (
          <li key={o.key} className="flex items-start gap-5 border-b border-mask-line/70 py-4">
            <DipSwitch label={o.title} on={!!s?.[o.key]} disabled={!s} onToggle={() => set({ [o.key]: !s?.[o.key] })} />
            <div>
              <h3 className="font-semibold">{o.title}</h3>
              <p className="text-[14px] text-silk-dim">{o.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="type-heading mb-4 text-[26px]">Ferramentas</h2>
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-line" onClick={() => window.fps.invoke('app:open-logs')}>
          Abrir pasta de registros
        </button>
        <button className="btn btn-line" onClick={() => action('app:restart-explorer', 'Explorador reiniciado')}>
          Reiniciar o Explorador
        </button>
        <button className="btn btn-line" onClick={() => action('app:reboot-firmware', 'Reiniciando na BIOS em 5 segundos')}>
          Reiniciar na BIOS
        </button>
      </div>
    </>
  )
}
