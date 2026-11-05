import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { MAX_ANSWER_LENGTH, MAX_QUESTION_LENGTH, type DueFlashcard } from '../../lib/flashcards'

const inputClass =
  'mt-1 w-full resize-none rounded-lg border border-white/15 bg-ink px-3 py-2 outline-none placeholder:text-white/30 focus:border-brand'

type NewFlashcardDialogProps = {
  onCreated: (card: DueFlashcard) => void
  onClose: () => void
}

// Janela para criar um flashcard à mão, com pergunta e resposta
export function NewFlashcardDialog({ onCreated, onClose }: NewFlashcardDialogProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (saving) return
    if (!question.trim()) return setError('Escreva a pergunta.')
    if (!answer.trim()) return setError('Escreva a resposta.')
    setSaving(true)
    setError(null)
    try {
      onCreated(await api.createFlashcard(question.trim(), answer.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setSaving(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void save()
  }

  // Nas caixas de texto, Enter pula linha. Ctrl+Enter (ou Cmd+Enter no Mac) salva.
  function handleKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      void save()
    }
  }

  return (
    <Modal title="Novo flashcard" onClose={onClose}>
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-5">
        <label className="block text-sm">
          <span className="text-white/70">Pergunta</span>
          <textarea
            autoFocus
            value={question}
            rows={2}
            maxLength={MAX_QUESTION_LENGTH}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ex.: O que é a derivada de uma função?"
            className={inputClass}
          />
        </label>

        <label className="block text-sm">
          <span className="text-white/70">Resposta</span>
          <textarea
            value={answer}
            rows={4}
            maxLength={MAX_ANSWER_LENGTH}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Ex.: A taxa de variação da função em um ponto."
            className={inputClass}
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
            {saving ? 'Salvando...' : 'Criar flashcard'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
