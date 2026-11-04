import { Layers, PartyPopper, PlayCircle, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../lib/api'
import { formatInterval, GRADE_BUTTONS, type DueFlashcard, type Grade } from '../../lib/flashcards'
import type { VideoFolder } from '../../lib/videos'
import { formatTimestamp } from '../../lib/youtubePlayer'
import { VideoPlayerDialog } from '../videos/VideoPlayerDialog'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }

const GRADE_STYLES: Record<Grade, string> = {
  again: 'border-rose-500/40 text-rose-300 hover:bg-rose-500/15',
  hard: 'border-amber-500/40 text-amber-300 hover:bg-amber-500/15',
  good: 'border-brand/50 text-brand hover:bg-brand/15',
  easy: 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15',
}

// Revisão dos flashcards do dia, um de cada vez (repetição espaçada)
export function ReviewPage() {
  const [folder, setFolder] = useState('all')
  const [folders, setFolders] = useState<VideoFolder[]>([])
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [queue, setQueue] = useState<DueFlashcard[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Record<Grade, number>>({ again: 0, hard: 0, good: 0, easy: 0 })
  const [watching, setWatching] = useState<DueFlashcard | null>(null)

  function startSession(selectedFolder: string) {
    setLoad({ status: 'loading' })
    setIndex(0)
    setRevealed(false)
    setError(null)
    setResults({ again: 0, hard: 0, good: 0, easy: 0 })
    api
      .getDueFlashcards(selectedFolder)
      .then((cards) => {
        setQueue(cards)
        setLoad({ status: 'ready' })
      })
      .catch((err: Error) => setLoad({ status: 'error', message: err.message }))
  }

  useEffect(() => {
    startSession(folder)
  }, [folder])

  useEffect(() => {
    api.getVideoFolders().then(setFolders).catch(() => setFolders([]))
  }, [])

  const card = queue[index]
  const done = load.status === 'ready' && queue.length > 0 && index >= queue.length
  const reviewed = Object.values(results).reduce((sum, n) => sum + n, 0)

  async function answer(grade: Grade) {
    if (!card || sending) return
    setSending(true)
    setError(null)
    try {
      await api.reviewFlashcard(card.id, grade)
      setResults((current) => ({ ...current, [grade]: current[grade] + 1 }))
      setIndex((current) => current + 1)
      setRevealed(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setSending(false)
    }
  }

  // Atalhos: Espaço mostra a resposta; 1, 2, 3 e 4 respondem
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (!card || watching || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault()
        setRevealed(true)
      } else if (revealed) {
        const button = GRADE_BUTTONS.find((b) => b.key === event.key)
        if (button) answer(button.grade)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Revisão</h1>
          <p className="mt-1 text-sm text-white/60">Flashcards que nascem das suas notas, na hora certa de revisar.</p>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-white/50">Vídeos de</span>
          <select
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            className="rounded-lg border border-white/15 bg-ink-light px-3 py-2 outline-none focus:border-brand"
          >
            <option value="all">Todas as pastas</option>
            <option value="none">Sem pasta</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {load.status === 'loading' && <p className="py-16 text-center text-white/50">Carregando flashcards...</p>}

      {load.status === 'error' && (
        <div className="py-16 text-center">
          <p className="text-rose-400">{load.message}</p>
          <button
            type="button"
            onClick={() => startSession(folder)}
            className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition hover:border-brand hover:text-brand"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Nada para revisar */}
      {load.status === 'ready' && queue.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center">
          <Layers className="mx-auto h-10 w-10 text-white/30" />
          <p className="mt-3 text-lg text-white/80">Nenhum flashcard para revisar agora.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
            Para criar flashcards, escreva nas notas de um vídeo uma linha no formato{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-brand">pergunta :: resposta</code>. Eles
            aparecem aqui automaticamente.
          </p>
          <Link to="/videos" className="mt-5 inline-block text-sm font-medium text-brand hover:text-white">
            Ir para os vídeos →
          </Link>
        </div>
      )}

      {/* Fim da sessão */}
      {done && (
        <div className="rounded-2xl border border-white/10 bg-ink-light px-6 py-12 text-center">
          <PartyPopper className="mx-auto h-10 w-10 text-brand" />
          <p className="mt-3 text-2xl font-semibold">Revisão concluída!</p>
          <p className="mt-1 text-white/60">
            {reviewed} {reviewed === 1 ? 'flashcard revisado' : 'flashcards revisados'}.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
            {GRADE_BUTTONS.map(({ grade, label }) => (
              <span key={grade} className={'rounded-lg border px-3 py-1.5 ' + GRADE_STYLES[grade]}>
                {label}: {results[grade]}
              </span>
            ))}
          </div>
          {results.again > 0 && (
            <p className="mt-4 text-sm text-white/50">Os que você errou voltam amanhã.</p>
          )}
          <button
            type="button"
            onClick={() => startSession(folder)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition hover:border-brand hover:text-brand"
          >
            <RotateCcw className="h-4 w-4" />
            Ver se sobrou algum
          </button>
        </div>
      )}

      {/* Flashcard atual */}
      {card && (
        <>
          <div className="mb-3 flex items-center justify-between text-sm text-white/50">
            <span className="font-mono text-xs uppercase tracking-wider">
              <span className="text-brand">•</span> {index + 1} de {queue.length}
              {card.isNew && <span className="ml-2 rounded bg-brand/15 px-1.5 py-0.5 text-brand">novo</span>}
            </span>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-brand transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-ink-light p-8">
            <p className="text-center text-2xl leading-snug font-semibold">{card.question}</p>

            {revealed ? (
              <>
                <div className="my-6 border-t border-white/10" />
                <p className="text-center text-lg leading-relaxed whitespace-pre-wrap text-white/85">{card.answer}</p>
              </>
            ) : (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="rounded-lg bg-brand px-6 py-2.5 font-semibold text-ink transition hover:bg-brand-dark"
                >
                  Mostrar resposta
                </button>
                <p className="mt-2 text-xs text-white/30">ou aperte Espaço</p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-white/40">
              <span className="truncate">De: {card.video.title}</span>
              <button
                type="button"
                onClick={() => setWatching(card)}
                className="inline-flex items-center gap-1 font-medium text-brand hover:text-white"
              >
                <PlayCircle className="h-4 w-4" />
                Ver no vídeo{card.videoSeconds !== null ? ` (${formatTimestamp(card.videoSeconds)})` : ''}
              </button>
            </div>
          </div>

          {revealed && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {GRADE_BUTTONS.map(({ grade, label, key }) => (
                <button
                  key={grade}
                  type="button"
                  disabled={sending}
                  onClick={() => answer(grade)}
                  className={'rounded-xl border px-3 py-3 transition disabled:opacity-40 ' + GRADE_STYLES[grade]}
                >
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-xs opacity-75">
                    {formatInterval(card.previews[grade])} · tecla {key}
                  </span>
                </button>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-center text-sm text-rose-400">{error}</p>}
        </>
      )}

      {watching && (
        <VideoPlayerDialog video={watching.video} startSeconds={watching.videoSeconds} onClose={() => setWatching(null)} />
      )}
    </div>
  )
}
