import { ExternalLink, NotebookPen } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { videoEmbedUrl, videoWatchUrl, type Video } from '../../lib/videos'

const MAX_NOTES_LENGTH = 200_000
const SAVE_DELAY = 800 // ms sem digitar antes de salvar

type NotesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready' }

type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

// Player do vídeo com o bloco de notas ao lado (ou embaixo, em telas estreitas)
export function VideoPlayerDialog({ video, onClose }: { video: Video; onClose: () => void }) {
  const [notesState, setNotesState] = useState<NotesState>({ status: 'loading' })
  const [notes, setNotes] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [closing, setClosing] = useState(false)
  // Texto ainda não salvo (null = nada pendente) e o salvamento agendado
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function loadNotes() {
    setNotesState({ status: 'loading' })
    api
      .getVideoNotes(video.id)
      .then((data) => {
        setNotes(data.notes)
        setNotesState({ status: 'ready' })
      })
      .catch((error: Error) => setNotesState({ status: 'error', message: error.message }))
  }

  useEffect(loadNotes, [video.id])

  // Salva o que estiver pendente. Retorna false se der erro.
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const text = pending.current
    if (text === null) return true
    pending.current = null
    setSaveStatus('saving')
    try {
      await api.saveVideoNotes(video.id, text)
      // Se o usuário digitou de novo enquanto salvava, continua "pendente"
      setSaveStatus(pending.current === null ? 'saved' : 'pending')
      return true
    } catch {
      if (pending.current === null) pending.current = text
      setSaveStatus('error')
      return false
    }
  }, [video.id])

  function handleChange(text: string) {
    setNotes(text)
    pending.current = text
    setSaveStatus('pending')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY)
  }

  // Fechar: salva antes o que faltar. Se falhar, mantém aberto para não perder o texto.
  async function handleClose() {
    if (closing) return
    setClosing(true)
    const ok = await flush()
    setClosing(false)
    if (ok) onClose()
  }

  // Se a aba do navegador for fechada com algo pendente, o navegador pergunta antes.
  // Se o player sumir da tela de outro jeito (ex.: mudar de página no menu), salva o que faltar.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (pending.current !== null) event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (timer.current) clearTimeout(timer.current)
      if (pending.current !== null) void api.saveVideoNotes(video.id, pending.current).catch(() => undefined)
    }
  }, [video.id])

  const saveLabel: Record<SaveStatus, string> = {
    saved: 'Salvo',
    pending: 'Alterações não salvas...',
    saving: 'Salvando...',
    error: 'Erro ao salvar — continue digitando para tentar de novo',
  }

  return (
    <Modal title={video.title} size="2xl" onClose={handleClose}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* Vídeo */}
        <div className="min-w-0">
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={videoEmbedUrl(video.youtubeId)}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-white/60">{video.channelName}</span>
            <a
              href={videoWatchUrl(video.youtubeId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-white"
            >
              Abrir no YouTube
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Bloco de notas */}
        <section className="flex min-h-72 flex-col" aria-label="Notas do vídeo">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white/60">
              <NotebookPen className="h-4 w-4 text-brand" />
              Minhas notas
            </h3>
            {notesState.status === 'ready' && (
              <span
                className={'text-xs ' + (saveStatus === 'error' ? 'text-rose-400' : 'text-white/40')}
                aria-live="polite"
              >
                {closing ? 'Salvando...' : saveLabel[saveStatus]}
              </span>
            )}
          </div>

          {notesState.status === 'loading' && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-white/10 text-sm text-white/50">
              Carregando notas...
            </div>
          )}

          {notesState.status === 'error' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-white/10 p-4 text-center text-sm">
              <p className="text-rose-400">{notesState.message}</p>
              <button
                type="button"
                onClick={loadNotes}
                className="rounded-lg border border-white/15 px-3 py-1.5 font-medium transition hover:border-brand hover:text-brand"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {notesState.status === 'ready' && (
            <>
              <textarea
                value={notes}
                onChange={(event) => handleChange(event.target.value)}
                maxLength={MAX_NOTES_LENGTH}
                placeholder="Escreva aqui o que for importante enquanto assiste..."
                aria-label="Notas do vídeo"
                className="min-h-64 flex-1 resize-none rounded-lg border border-white/10 bg-ink p-3 text-sm leading-relaxed outline-none placeholder:text-white/30 focus:border-brand"
              />
              <p
                className={
                  'mt-1.5 text-right text-xs ' + (notes.length >= MAX_NOTES_LENGTH ? 'text-amber-400' : 'text-white/30')
                }
              >
                {notes.length.toLocaleString('pt-BR')} / {MAX_NOTES_LENGTH.toLocaleString('pt-BR')} caracteres
              </p>
            </>
          )}
        </section>
      </div>
    </Modal>
  )
}
