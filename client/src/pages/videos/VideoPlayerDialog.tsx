import { ExternalLink, NotebookPen, Timer } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { videoEmbedUrl, videoWatchUrl, type Video } from '../../lib/videos'
import {
  extractTimestamps,
  findTimestampAt,
  formatTimestamp,
  loadYoutubeApi,
  type YoutubePlayer,
} from '../../lib/youtubePlayer'

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
  // Controle do player do YouTube (para ler o tempo atual e pular para um momento)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const player = useRef<YoutubePlayer | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerError, setPlayerError] = useState(false)

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

  // Liga o app ao player do YouTube que está na tela
  useEffect(() => {
    let active = true
    setPlayerReady(false)
    loadYoutubeApi()
      .then((YT) => {
        if (!active || !iframeRef.current) return
        player.current = new YT.Player(iframeRef.current, {
          events: { onReady: () => active && setPlayerReady(true) },
        })
      })
      .catch(() => active && setPlayerError(true))
    return () => {
      active = false
      player.current = null
    }
  }, [video.id])

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

  // Insere o tempo atual do vídeo, ex. "[12:34] ", no começo de uma linha onde o cursor está
  function insertTimestamp() {
    const textarea = textareaRef.current
    if (!player.current || !playerReady || !textarea) return
    const stamp = `[${formatTimestamp(player.current.getCurrentTime())}] `
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = notes.slice(0, start)
    // Se o cursor está no meio de uma linha, a marcação começa numa linha nova
    const insert = (before.length > 0 && !before.endsWith('\n') ? '\n' : '') + stamp
    const next = before + insert + notes.slice(end)
    if (next.length > MAX_NOTES_LENGTH) return
    handleChange(next)
    // Coloca o cursor logo depois da marcação, pronto para escrever
    const caret = start + insert.length
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(caret, caret)
    })
  }

  // Leva o vídeo até o momento marcado e dá play
  function seekTo(seconds: number) {
    if (!player.current || !playerReady) return
    player.current.seekTo(seconds, true)
    player.current.playVideo()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl+Enter (ou Cmd+Enter no Mac) marca o tempo atual
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      insertTimestamp()
    }
  }

  function handleClick(event: MouseEvent<HTMLTextAreaElement>) {
    // Ctrl+clique numa marcação pula para aquele momento do vídeo
    if (!(event.ctrlKey || event.metaKey)) return
    const seconds = findTimestampAt(notes, event.currentTarget.selectionStart)
    if (seconds !== null) seekTo(seconds)
  }

  const markers = useMemo(() => extractTimestamps(notes), [notes])

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
              ref={iframeRef}
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
              <div className="flex items-center gap-3">
                <span
                  className={'text-xs ' + (saveStatus === 'error' ? 'text-rose-400' : 'text-white/40')}
                  aria-live="polite"
                >
                  {closing ? 'Salvando...' : saveLabel[saveStatus]}
                </span>
                <button
                  type="button"
                  onClick={insertTimestamp}
                  disabled={!playerReady}
                  title={
                    playerError
                      ? 'Não foi possível conectar ao player do YouTube'
                      : playerReady
                        ? 'Marca o tempo atual do vídeo nas notas (Ctrl+Enter)'
                        : 'Esperando o player carregar...'
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-medium transition hover:border-brand hover:text-brand disabled:opacity-40"
                >
                  <Timer className="h-4 w-4" />
                  Marcar tempo
                </button>
              </div>
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
                ref={textareaRef}
                value={notes}
                onChange={(event) => handleChange(event.target.value)}
                onKeyDown={handleKeyDown}
                onClick={handleClick}
                maxLength={MAX_NOTES_LENGTH}
                placeholder="Escreva aqui o que for importante enquanto assiste..."
                aria-label="Notas do vídeo"
                className="min-h-64 flex-1 resize-none rounded-lg border border-white/10 bg-ink p-3 text-sm leading-relaxed outline-none placeholder:text-white/30 focus:border-brand"
              />
              <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-white/30">
                <span>Ctrl+Enter marca o tempo · Ctrl+clique numa marcação pula para ela</span>
                <span className={notes.length >= MAX_NOTES_LENGTH ? 'text-amber-400' : ''}>
                  {notes.length.toLocaleString('pt-BR')} / {MAX_NOTES_LENGTH.toLocaleString('pt-BR')} caracteres
                </span>
              </div>

              {/* Lista de marcações: clicar leva o vídeo até o momento */}
              {markers.length > 0 && (
                <div className="mt-3">
                  <h4 className="mb-1.5 font-mono text-xs uppercase tracking-wider text-white/50">
                    <span className="text-brand">•</span> Marcações ({markers.length})
                  </h4>
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto pr-1">
                    {markers.map((marker) => (
                      <li key={marker.key}>
                        <button
                          type="button"
                          onClick={() => seekTo(marker.seconds)}
                          disabled={!playerReady}
                          className="flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left text-sm transition hover:bg-white/5 disabled:opacity-40"
                        >
                          <span className="shrink-0 font-mono text-xs text-brand">{formatTimestamp(marker.seconds)}</span>
                          <span className={'truncate ' + (marker.label ? 'text-white/80' : 'text-white/30 italic')}>
                            {marker.label || 'sem descrição'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </Modal>
  )
}
