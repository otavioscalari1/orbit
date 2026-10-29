import { useState, type ReactNode } from 'react'
import { Modal } from './Modal'

type ConfirmDialogProps = {
  title: string
  children: ReactNode // a pergunta / explicação
  confirmLabel: string
  onConfirm: () => Promise<void>
  onClose: () => void
}

// Janela de confirmação para ações destrutivas (excluir, remover...). Mostra o erro se a ação falhar.
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-5">
        <div className="text-sm text-white/70">{children}</div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-40"
          >
            {saving ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
