import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { TweakMeta } from '@shared/types'
import { useTweaks } from '../lib/tweaks'
import { Modal } from './Modal'

/** Confirmation shown before applying a risky or non-reversible tweak. */
export function ConfirmTweak({ tweak, onClose }: { tweak: TweakMeta; onClose: () => void }) {
  const run = useTweaks((s) => s.run)
  return (
    <Modal
      title={tweak.title}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className={tweak.risk === 'caution' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => {
              onClose()
              run(tweak, true)
            }}
          >
            Aplicar
          </button>
        </>
      }
    >
      <Markdown remarkPlugins={[remarkGfm]}>{tweak.confirm ?? tweak.description}</Markdown>
      {!tweak.reversible && (
        <p>
          <strong>Este ajuste não tem reversão automática.</strong> Para desfazer, use um ponto de restauração em Backup.
        </p>
      )}
    </Modal>
  )
}
