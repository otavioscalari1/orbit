import { Check, Folder, Inbox } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import type { Video, VideoFolder } from '../../lib/videos'

// Formulário para criar ou renomear uma pasta
export function FolderFormDialog({
  folder,
  onSave,
  onClose,
}: {
  folder?: VideoFolder // presente = renomear
  onSave: (name: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(folder?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Dê um nome para a pasta.')
    setSaving(true)
    setError(null)
    try {
      await onSave(name.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setSaving(false)
    }
  }

  return (
    <Modal title={folder ? 'Renomear pasta' : 'Nova pasta'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-sm">
          <span className="text-white/70">Nome</span>
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Cálculo 1"
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 outline-none placeholder:text-white/30 focus:border-brand"
          />
        </label>
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
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-40"
          >
            {saving ? 'Salvando...' : folder ? 'Salvar' : 'Criar pasta'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Escolher para qual pasta mover um vídeo
export function MoveVideoDialog({
  video,
  folders,
  onMove,
  onClose,
}: {
  video: Video
  folders: VideoFolder[]
  onMove: (folderId: string | null) => Promise<void>
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function move(folderId: string | null) {
    if (folderId === video.folderId) return onClose()
    setSaving(true)
    setError(null)
    try {
      await onMove(folderId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setSaving(false)
    }
  }

  const options = [{ id: null, name: 'Sem pasta' }, ...folders.map((folder) => ({ id: folder.id, name: folder.name }))]

  return (
    <Modal title="Mover para pasta" onClose={onClose}>
      <p className="mb-4 line-clamp-2 text-sm text-white/60">{video.title}</p>
      <ul className="max-h-80 space-y-1 overflow-y-auto">
        {options.map((option) => {
          const current = option.id === video.folderId
          const Icon = option.id === null ? Inbox : Folder
          return (
            <li key={option.id ?? 'none'}>
              <button
                type="button"
                disabled={saving}
                onClick={() => move(option.id)}
                className={
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition disabled:opacity-40 ' +
                  (current ? 'bg-brand/15 text-brand' : 'text-white/80 hover:bg-white/5')
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{option.name}</span>
                {current && <Check className="ml-auto h-4 w-4 shrink-0" />}
              </button>
            </li>
          )
        })}
      </ul>
      {folders.length === 0 && (
        <p className="mt-3 text-xs text-white/40">Crie pastas na coluna "Pastas" para organizar seus vídeos.</p>
      )}
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </Modal>
  )
}
