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
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function Empty({ children }: { children: string }) {
  return <p className="px-4 py-6 text-muted">{children}</p>
}

export function Backup() {
  const [points, setPoints] = useState<RestorePoint[] | null>(null)
  const [regs, setRegs] = useState<RegistryBackup[] | null>(null)
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
        lead="Um ponto de restauração devolve o Windows inteiro a um momento. Uma cópia do registro desfaz só um ajuste."
      />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section aria-labelledby="rp" className="card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 id="rp" className="font-semibold">
              Pontos de restauração
            </h2>
            {points && points.length > 0 && (
              <button className="btn btn-danger btn-sm" onClick={() => setWiping(true)}>
                Apagar todos
              </button>
            )}
          </div>
          <form
            className="flex gap-2 border-b border-line p-3"
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
              className="field min-w-0 flex-1"
              placeholder="Nome, por exemplo: antes do driver novo"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn btn-primary" disabled={creating}>
              {creating ? 'Criando…' : 'Criar ponto'}
            </button>
          </form>
          {points == null ? (
            <Empty>Lendo pontos de restauração…</Empty>
          ) : points.length === 0 ? (
            <Empty>Nenhum ponto de restauração neste PC. Crie um antes de aplicar ajustes.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th className="px-4 py-2 font-normal">Nome</th>
                  <th className="px-4 py-2 font-normal">Criado em</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.sequence} className="border-t border-line">
                    <td className="px-4 py-2">{p.description}</td>
                    <td className="num whitespace-nowrap px-4 py-2 text-[15px] text-muted">{fmt(p.createdAt)}</td>
                    <td className="px-4 py-2 text-right">
                      <button className="btn btn-ghost btn-sm" onClick={() => setRestoring(p)}>
                        Restaurar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-labelledby="reg" className="card">
          <h2 id="reg" className="border-b border-line px-4 py-3 font-semibold">
            Cópias do registro
          </h2>
          {regs == null ? (
            <Empty>Lendo cópias…</Empty>
          ) : regs.length === 0 ? (
            <Empty>Antes de cada ajuste que mexe no registro, as chaves afetadas são copiadas para cá. Ainda não há cópias.</Empty>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th className="px-4 py-2 font-normal">Ajuste</th>
                  <th className="px-4 py-2 font-normal">Criada em</th>
                  <th className="px-4 py-2 text-right font-normal">Tamanho</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {regs.map((r) => (
                  <tr key={r.file} className="border-t border-line">
                    <td className="px-4 py-2">{r.tweakId}</td>
                    <td className="num whitespace-nowrap px-4 py-2 text-[15px] text-muted">{fmt(r.createdAt)}</td>
                    <td className="num px-4 py-2 text-right text-[15px] text-muted">{r.sizeKb} KB</td>
                    <td className="px-4 py-2 text-right">
                      <button className="btn btn-ghost btn-sm" onClick={() => restoreReg(r)}>
                        Restaurar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {restoring && (
        <Modal
          title="Restaurar o Windows?"
          onClose={() => setRestoring(null)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setRestoring(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
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
              <button className="btn btn-ghost" onClick={() => setWiping(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
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
            Isso libera espaço em disco, mas <strong>não tem volta</strong>: você não poderá mais restaurar o Windows para nenhum
            desses momentos.
          </p>
        </Modal>
      )}
    </>
  )
}
