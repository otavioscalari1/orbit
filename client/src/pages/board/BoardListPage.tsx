import { NotebookPen, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import type { NoteSummary } from '../../lib/board'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }

// "Editada há pouco" em formato curto: "27 de out., 14:32"
function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Lista de anotações da Lousa. Clicar numa anotação abre as folhas dela.
export function BoardListPage() {
  const navigate = useNavigate()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<NoteSummary | null>(null)

  function loadNotes() {
    setLoad({ status: 'loading' })
    api
      .getNotes()
      .then((data) => {
        setNotes(data)
        setLoad({ status: 'ready' })
      })
      .catch((error: Error) => setLoad({ status: 'error', message: error.message }))
  }

  useEffect(loadNotes, [])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Lousa</h1>
          <p className="mt-1 text-sm text-white/60">Suas anotações à mão, em folhas A4 pautadas.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark"
        >
          <Plus className="h-4 w-4" />
          Nova anotação
        </button>
      </div>

      {load.status === 'loading' && <p className="py-12 text-center text-white/50">Carregando anotações...</p>}

      {load.status === 'error' && (
        <div className="py-12 text-center">
          <p className="text-rose-400">{load.message}</p>
          <button
            type="button"
            onClick={loadNotes}
            className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition hover:border-brand hover:text-brand"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {load.status === 'ready' && notes.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 py-16 text-center">
          <NotebookPen className="mx-auto h-10 w-10 text-white/30" />
          <p className="mt-3 text-white/70">Nenhuma anotação ainda.</p>
          <p className="text-sm text-white/40">
            Clique em <span className="text-brand">Nova anotação</span> para começar a escrever.
          </p>
        </div>
      )}

      {load.status === 'ready' && notes.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {notes.map((note) => (
            <li key={note.id} className="group relative">
              <Link
                to={`/lousa/${note.id}`}
                className="block rounded-xl border border-white/10 bg-ink-light p-4 transition hover:border-brand/50"
              >
                {/* Miniatura de folha pautada na cor escolhida */}
                <div
                  className={
                    'mb-4 aspect-[210/297] w-full rounded-md border ' +
                    (note.paperTheme === 'light' ? 'border-white/10 bg-white' : 'border-white/10 bg-[#1b2027]')
                  }
                  style={{
                    backgroundImage: `linear-gradient(to bottom, ${
                      note.paperTheme === 'light' ? '#c9d9ea' : 'rgba(255,255,255,0.09)'
                    } 1px, transparent 1px)`,
                    backgroundSize: '100% 8%',
                    backgroundPosition: '0 12%',
                  }}
                />
                <p className="truncate font-semibold">{note.title}</p>
                <p className="mt-1 text-xs text-white/50">
                  {note.pageCount} {note.pageCount === 1 ? 'folha' : 'folhas'} · {formatUpdatedAt(note.updatedAt)}
                </p>
              </Link>
              <button
                type="button"
                aria-label={`Excluir ${note.title}`}
                onClick={() => setDeleting(note)}
                className="absolute top-6 right-6 rounded-lg bg-ink/80 p-2 text-white/60 opacity-0 transition group-hover:opacity-100 hover:text-rose-400 focus:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <Modal title="Nova anotação" onClose={() => setCreating(false)}>
          <CreateNoteForm
            onCancel={() => setCreating(false)}
            onCreate={async (title) => {
              const note = await api.createNote(title)
              navigate(`/lousa/${note.id}`)
            }}
          />
        </Modal>
      )}

      {deleting && (
        <Modal title="Excluir anotação" onClose={() => setDeleting(null)}>
          <ConfirmDelete
            note={deleting}
            onCancel={() => setDeleting(null)}
            onConfirm={async () => {
              await api.deleteNote(deleting.id)
              setNotes((current) => current.filter((note) => note.id !== deleting.id))
              setDeleting(null)
            }}
          />
        </Modal>
      )}
    </div>
  )
}

function CreateNoteForm({ onCreate, onCancel }: { onCreate: (title: string) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return setError('Dê um nome para a anotação.')
    setSaving(true)
    setError(null)
    try {
      await onCreate(title.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block text-sm">
        <span className="text-white/70">Nome</span>
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ex.: Cálculo 1 — Limites"
          className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 outline-none placeholder:text-white/30 focus:border-brand"
        />
      </label>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-40"
        >
          {saving ? 'Criando...' : 'Criar e abrir'}
        </button>
      </div>
    </form>
  )
}

function ConfirmDelete({
  note,
  onConfirm,
  onCancel,
}: {
  note: NoteSummary
  onConfirm: () => Promise<void>
  onCancel: () => void
}) {
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
    <div className="space-y-5">
      <p className="text-sm text-white/70">
        Excluir <span className="font-semibold text-white">{note.title}</span> e{' '}
        {note.pageCount === 1 ? 'sua folha' : `suas ${note.pageCount} folhas`}? Não dá para desfazer.
      </p>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
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
          {saving ? 'Excluindo...' : 'Excluir'}
        </button>
      </div>
    </div>
  )
}
