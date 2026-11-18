import { Check, Crown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from '../lib/account'
import { Modal } from './Modal'

export const PREMIUM_BENEFITS = [
  'Ajustes avançados (núcleos da CPU, compressão de memória, tela cheia exclusiva…)',
  '"Otimizar agora": todos os recomendados com um clique',
  'Limpeza, Modo jogo e Placa de vídeo quando forem lançados',
  'Atualizações e novos ajustes incluídos'
]

/** Shown when a free user tries a Premium feature. Mounted once in the shell. */
export function Upsell() {
  const { upsellOpen, closeUpsell } = useAccount()
  const navigate = useNavigate()
  if (!upsellOpen) return null
  return (
    <Modal
      title="Recurso Premium"
      onClose={closeUpsell}
      actions={
        <>
          <button className="btn btn-ghost" onClick={closeUpsell}>
            Agora não
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              closeUpsell()
              navigate('/license')
            }}
          >
            <Crown size={15} /> Ativar chave
          </button>
        </>
      }
    >
      <p>Este recurso faz parte do plano Premium. Com uma chave ativa você tem:</p>
      <ul className="!list-none !pl-0">
        {PREMIUM_BENEFITS.map((b) => (
          <li key={b} className="mb-1.5 flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-up" /> <span>{b}</span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
