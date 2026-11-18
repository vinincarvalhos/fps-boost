import { useCallback, useEffect, useState } from 'react'
import type { RestorePoint } from '@shared/types'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { toast } from '../lib/toast'

interface RegistryBackup {
  file: string
  tweakId: string
  createdAt: string
  sizeKb: number
}
type Result = { ok: boolean; error?: string }

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function Backup() {
  const [points, setPoints] = useState<RestorePoint[] | null>(null)
  const [regs, setRegs] = useState<RegistryBackup[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [restoring, setRestoring] = useState<RestorePoint | null>(null)
  const [wiping, setWiping] = useState(false)

  const load = useCallback(() => {
    window.fps.invoke<RestorePoint[]>('backup:list').then(setPoints)
    window.fps.invoke<RegistryBackup[]>('backup:registry-list').then(setRegs)
  }, [])
  useEffect(load, [load])

  const create = async () => {
    setCreating(true)
    const res = await window.fps.invoke<Result>('backup:create', name.trim() || 'FpsBoost')
    setCreating(false)
    if (res.ok) {
      toast.ok('Ponto de restauração criado')
      setName('')
      load()
    } else toast.error(`O ponto de restauração não foi criado.\n${res.error ?? ''}`)
  }

  const restoreReg = async (r: RegistryBackup) => {
    const res = await window.fps.invoke<Result>('backup:registry-restore', r.file)
    if (res.ok) toast.ok('Cópia do registro restaurada')
    else toast.error(`A cópia do registro não foi restaurada.\n${res.error ?? ''}`)
  }

  return (
    <>
      <PageHeader
        title="Backup"
        lead="Um ponto de restauração devolve o Windows inteiro ao estado de um momento. As cópias do registro desfazem um ajuste específico."
      />

      <section aria-labelledby="rp-title" className="mb-14">
        <h2 id="rp-title" className="type-heading mb-4 text-[26px]">
          Pontos de restauração
        </h2>
        <form
          className="mb-6 flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <label className="sr-only" htmlFor="rp-name">
            Nome do ponto
          </label>
          <input
            id="rp-name"
            className="field w-80"
            placeholder="Nome, por exemplo: antes do driver novo"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-gold" disabled={creating}>
            {creating ? 'Criando… pode levar um minuto' : 'Criar ponto de restauração'}
          </button>
        </form>

        {points == null ? (
          <p className="text-silk-dim">Lendo pontos de restauração…</p>
        ) : points.length === 0 ? (
          <p className="max-w-[60ch] text-silk-dim">
            Nenhum ponto de restauração neste PC. Crie um agora, antes de aplicar ajustes.
          </p>
        ) : (
          <table className="w-full text-left text-[14px]">
            <thead className="text-silk-dim">
              <tr className="border-b border-mask-line">
                <th className="py-2 font-normal">Nome</th>
                <th className="py-2 font-normal">Criado em</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.sequence} className="border-b border-mask-line/60">
                  <td className="py-3">{p.description}</td>
                  <td className="py-3 text-silk-dim">{fmt(p.createdAt)}</td>
                  <td className="py-3 text-right">
                    <button className="btn btn-line py-1.5" onClick={() => setRestoring(p)}>
                      Restaurar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {points && points.length > 0 && (
          <button className="btn btn-flux mt-6" onClick={() => setWiping(true)}>
            Apagar todos os pontos
          </button>
        )}
      </section>

      <section aria-labelledby="reg-title">
        <h2 id="reg-title" className="type-heading mb-4 text-[26px]">
          Cópias do registro
        </h2>
        {regs.length === 0 ? (
          <p className="max-w-[60ch] text-silk-dim">
            Antes de cada ajuste que mexe no registro, as chaves afetadas são copiadas para cá. Ainda não há cópias.
          </p>
        ) : (
          <ul>
            {regs.map((r) => (
              <li key={r.file} className="flex items-center gap-4 border-b border-mask-line/60 py-3 text-[14px]">
                <span className="flex-1">{r.tweakId}</span>
                <span className="text-silk-dim">{fmt(r.createdAt)}</span>
                <span className="w-16 text-right text-silk-dim">{r.sizeKb} KB</span>
                <button className="btn btn-line py-1.5" onClick={() => restoreReg(r)}>
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {restoring && (
        <Modal
          title="Restaurar o Windows?"
          onClose={() => setRestoring(null)}
          actions={
            <>
              <button className="btn btn-line" onClick={() => setRestoring(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-gold"
                onClick={async () => {
                  const p = restoring
                  setRestoring(null)
                  const res = await window.fps.invoke<Result>('backup:restore', p.sequence)
                  if (!res.ok) toast.error(`A restauração não começou.\n${res.error ?? ''}`)
                }}
              >
                Restaurar e reiniciar
              </button>
            </>
          }
        >
          <p>
            O computador vai reiniciar e voltar para <strong>{restoring.description}</strong>, de {fmt(restoring.createdAt)}.
          </p>
          <p>Programas instalados depois dessa data podem parar de funcionar. Seus arquivos pessoais não são afetados.</p>
        </Modal>
      )}

      {wiping && (
        <Modal
          title="Apagar todos os pontos de restauração?"
          onClose={() => setWiping(false)}
          actions={
            <>
              <button className="btn btn-line" onClick={() => setWiping(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-flux"
                onClick={async () => {
                  setWiping(false)
                  const res = await window.fps.invoke<Result>('backup:delete-all')
                  if (res.ok) toast.ok('Pontos de restauração apagados')
                  else toast.error(`Os pontos não foram apagados.\n${res.error ?? ''}`)
                  load()
                }}
              >
                Apagar todos
              </button>
            </>
          }
        >
          <p>
            Isso libera espaço em disco, mas <strong>não tem volta</strong>: você não poderá mais restaurar o Windows para
            nenhum desses momentos.
          </p>
        </Modal>
      )}
    </>
  )
}
