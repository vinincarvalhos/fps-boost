import { useEffect, useState, type ReactNode } from 'react'
import type { Settings as SettingsT } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Toggle } from '../components/Toggle'
import { toast } from '../lib/toast'
import { UpdatesCard } from '../components/UpdatesCard'

const OPTIONS: { key: keyof SettingsT; title: string; text: string }[] = [
  { key: 'autostart', title: 'Abrir com o Windows', text: 'O FpsBoost inicia minimizado quando você entra no Windows.' },
  { key: 'tray', title: 'Manter na bandeja', text: 'Fechar a janela deixa o FpsBoost rodando ao lado do relógio.' },
  { key: 'autoRestorePoint', title: 'Ponto de restauração automático', text: 'Cria um ponto de restauração antes do primeiro ajuste aplicado.' }
]

function Row({ title, text, control }: { title: string; text: string; control: ReactNode }) {
  return (
    <li className="flex items-center gap-4 border-t border-line px-4 py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-[13px] text-muted">{text}</p>
      </div>
      {control}
    </li>
  )
}

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
      <PageHeader title="Configurações" lead={version ? `FpsBoost versão ${version}` : undefined} />

      <div className="grid max-w-[880px] gap-4">
        <section aria-labelledby="general" className="card">
          <h2 id="general" className="border-b border-line px-4 py-3 font-semibold">
            Geral
          </h2>
          <ul>
            {OPTIONS.map((o) => (
              <Row
                key={o.key}
                title={o.title}
                text={o.text}
                control={<Toggle label={o.title} on={!!s?.[o.key]} disabled={!s} onToggle={() => set({ [o.key]: !s?.[o.key] })} />}
              />
            ))}
          </ul>
        </section>

        <UpdatesCard />

        <section aria-labelledby="tools" className="card">
          <h2 id="tools" className="border-b border-line px-4 py-3 font-semibold">
            Ferramentas
          </h2>
          <ul>
            <Row
              title="Registros do FpsBoost"
              text="Arquivos de log, úteis para entender um ajuste que falhou."
              control={
                <button className="btn btn-ghost btn-sm" onClick={() => window.fps.invoke('app:open-logs')}>
                  Abrir pasta
                </button>
              }
            />
            <Row
              title="Reiniciar o Explorador"
              text="Recarrega a barra de tarefas e o menu Iniciar para aplicar ajustes de interface."
              control={
                <button className="btn btn-ghost btn-sm" onClick={() => action('app:restart-explorer', 'Explorador reiniciado')}>
                  Reiniciar
                </button>
              }
            />
            <Row
              title="Reiniciar na BIOS"
              text="Reinicia o computador direto na configuração da placa-mãe (UEFI) em 5 segundos."
              control={
                <button className="btn btn-ghost btn-sm" onClick={() => action('app:reboot-firmware', 'Reiniciando na BIOS em 5 segundos')}>
                  Reiniciar na BIOS
                </button>
              }
            />
          </ul>
        </section>
      </div>
    </>
  )
}
