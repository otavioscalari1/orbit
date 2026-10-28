import {
  ArrowLeft,
  Download,
  Eraser,
  FilePlus,
  Highlighter,
  Moon,
  PenLine,
  Redo2,
  Sun,
  Trash2,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import {
  HIGHLIGHTER_COLORS,
  PAPER_STYLES,
  PEN_COLORS,
  SIZES,
  type NoteDetail,
  type NotePage,
  type PaperTheme,
  type Stroke,
  type Tool,
} from '../../lib/board'
import { exportNoteToPdf } from '../../lib/exportPdf'
import { PageCanvas } from './PageCanvas'

const SAVE_DELAY = 700 // ms sem desenhar antes de salvar a folha no banco

type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'
type HistoryEntry = { pageId: string; before: Stroke[]; after: Stroke[] }

const TOOLS: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: 'pen', label: 'Caneta', icon: PenLine },
  { id: 'highlighter', label: 'Marca-texto', icon: Highlighter },
  { id: 'eraser', label: 'Borracha (apaga o traço inteiro)', icon: Eraser },
]

export function NoteEditorPage() {
  const { noteId = '' } = useParams()
  const [note, setNote] = useState<NoteDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [highlighterColor, setHighlighterColor] = useState(HIGHLIGHTER_COLORS[0])
  const [sizeIndex, setSizeIndex] = useState<Record<Tool, number>>({ pen: 1, highlighter: 1, eraser: 1 })
  const [history, setHistory] = useState<{ past: HistoryEntry[]; future: HistoryEntry[] }>({ past: [], future: [] })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmDeletePage, setConfirmDeletePage] = useState(false)

  // Salvamentos agendados por folha (para juntar vários traços seguidos num salvamento só)
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pendingStrokes = useRef(new Map<string, Stroke[]>())

  useEffect(() => {
    api
      .getNote(noteId)
      .then((data) => {
        setNote(data)
        setTitle(data.title)
        setActivePageId(data.pages[0]?.id ?? null)
      })
      .catch((error: Error) => setLoadError(error.message))
  }, [noteId])

  const savePage = useCallback(
    async (pageId: string) => {
      const strokes = pendingStrokes.current.get(pageId)
      saveTimers.current.delete(pageId)
      if (!strokes) return
      pendingStrokes.current.delete(pageId)
      setSaveStatus('saving')
      try {
        await api.saveNotePage(noteId, pageId, strokes)
        setSaveStatus(pendingStrokes.current.size > 0 ? 'pending' : 'saved')
      } catch {
        // Devolve para a fila: tenta de novo no próximo traço
        if (!pendingStrokes.current.has(pageId)) pendingStrokes.current.set(pageId, strokes)
        setSaveStatus('error')
      }
    },
    [noteId],
  )

  function scheduleSave(pageId: string, strokes: Stroke[]) {
    pendingStrokes.current.set(pageId, strokes)
    setSaveStatus('pending')
    clearTimeout(saveTimers.current.get(pageId))
    saveTimers.current.set(pageId, setTimeout(() => savePage(pageId), SAVE_DELAY))
  }

  // Salva na hora tudo que estiver pendente (usado ao sair da tela)
  const flushSaves = useCallback(() => {
    for (const [pageId, timer] of saveTimers.current) {
      clearTimeout(timer)
      savePage(pageId)
    }
  }, [savePage])

  // Ao sair da tela: salva o que faltar. Ao fechar a aba com algo pendente: avisa o usuário.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (pendingStrokes.current.size > 0) event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      flushSaves()
    }
  }, [flushSaves])

  function setPageStrokes(pageId: string, strokes: Stroke[]) {
    setNote((current) =>
      current && { ...current, pages: current.pages.map((page) => (page.id === pageId ? { ...page, strokes } : page)) },
    )
    scheduleSave(pageId, strokes)
  }

  function handleDraw(page: NotePage, strokes: Stroke[]) {
    setHistory(({ past }) => ({ past: [...past, { pageId: page.id, before: page.strokes, after: strokes }], future: [] }))
    setPageStrokes(page.id, strokes)
  }

  function undo() {
    const entry = history.past[history.past.length - 1]
    if (!entry) return
    setHistory(({ past, future }) => ({ past: past.slice(0, -1), future: [entry, ...future] }))
    setPageStrokes(entry.pageId, entry.before)
    setActivePageId(entry.pageId)
  }

  function redo() {
    const entry = history.future[0]
    if (!entry) return
    setHistory(({ past, future }) => ({ past: [...past, entry], future: future.slice(1) }))
    setPageStrokes(entry.pageId, entry.after)
    setActivePageId(entry.pageId)
  }

  // Atalhos: Ctrl+Z desfaz, Ctrl+Y ou Ctrl+Shift+Z refaz
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || (event.target as HTMLElement).tagName === 'INPUT') return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  async function runAction(action: () => Promise<void>) {
    setActionError(null)
    try {
      await action()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Algo deu errado.')
    }
  }

  if (loadError) {
    return (
      <div className="py-12 text-center">
        <p className="text-rose-400">{loadError}</p>
        <Link to="/lousa" className="mt-4 inline-block text-sm text-brand hover:text-white">
          Voltar para as anotações
        </Link>
      </div>
    )
  }

  if (!note) return <p className="py-12 text-center text-white/50">Abrindo anotação...</p>

  const activePage = note.pages.find((page) => page.id === activePageId) ?? note.pages[0]
  const activeIndex = note.pages.indexOf(activePage)
  const color = tool === 'highlighter' ? highlighterColor : penColor
  const size = SIZES[tool][sizeIndex[tool]]

  function addPage() {
    runAction(async () => {
      const created = await api.addNotePage(note!.id, activePage.position)
      setNote((current) => {
        if (!current) return current
        const shifted = current.pages.map((page) =>
          page.position >= created.position ? { ...page, position: page.position + 1 } : page,
        )
        return { ...current, pages: [...shifted, created].sort((a, b) => a.position - b.position) }
      })
      setActivePageId(created.id)
      // Rola até a folha nova depois que ela aparecer na tela
      setTimeout(() => document.getElementById(`page-${created.id}`)?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
  }

  function deletePage() {
    runAction(async () => {
      const removed = activePage
      clearTimeout(saveTimers.current.get(removed.id))
      saveTimers.current.delete(removed.id)
      pendingStrokes.current.delete(removed.id)
      await api.deleteNotePage(note!.id, removed.id)
      const remaining = note!.pages
        .filter((page) => page.id !== removed.id)
        .map((page) => (page.position > removed.position ? { ...page, position: page.position - 1 } : page))
      setNote({ ...note!, pages: remaining })
      setActivePageId(remaining[Math.min(activeIndex, remaining.length - 1)]?.id ?? null)
      // O histórico daquela folha não faz mais sentido
      setHistory(({ past, future }) => ({
        past: past.filter((entry) => entry.pageId !== removed.id),
        future: future.filter((entry) => entry.pageId !== removed.id),
      }))
      setConfirmDeletePage(false)
      if (pendingStrokes.current.size === 0) setSaveStatus('saved')
    })
  }

  function togglePaperTheme() {
    const paperTheme: PaperTheme = note!.paperTheme === 'light' ? 'dark' : 'light'
    setNote({ ...note!, paperTheme })
    runAction(async () => {
      await api.updateNote(note!.id, { paperTheme })
    })
  }

  function saveTitle() {
    const trimmed = title.trim()
    if (!trimmed || trimmed === note!.title) {
      setTitle(note!.title)
      return
    }
    setNote({ ...note!, title: trimmed })
    runAction(async () => {
      await api.updateNote(note!.id, { title: trimmed })
    })
  }

  function exportPdf() {
    runAction(async () => exportNoteToPdf({ ...note!, title: title.trim() || note!.title }))
  }

  const saveLabel: Record<SaveStatus, string> = {
    saved: 'Salvo',
    pending: 'Alterações não salvas...',
    saving: 'Salvando...',
    error: 'Erro ao salvar — continue desenhando para tentar de novo',
  }

  return (
    <div className="-mx-6 -mt-6">
      {/* Barra de ferramentas fixa no topo */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-ink/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/lousa"
            aria-label="Voltar para as anotações"
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
            aria-label="Nome da anotação"
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-semibold outline-none hover:border-white/10 focus:border-brand"
          />
          <span
            className={'text-xs ' + (saveStatus === 'error' ? 'text-rose-400' : 'text-white/40')}
            aria-live="polite"
          >
            {saveLabel[saveStatus]}
          </span>
          <button
            type="button"
            onClick={togglePaperTheme}
            className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium transition hover:border-brand hover:text-brand"
          >
            {note.paperTheme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {note.paperTheme === 'light' ? 'Folha escura' : 'Folha branca'}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className="flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* Ferramentas */}
          <div className="flex gap-1 rounded-lg border border-white/10 p-1">
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={tool === id}
                onClick={() => setTool(id)}
                className={
                  'rounded-md p-2 transition ' +
                  (tool === id ? 'bg-brand text-ink' : 'text-white/70 hover:bg-white/5 hover:text-white')
                }
              >
                <Icon className="h-5 w-5" />
              </button>
            ))}
          </div>

          {/* Cores (não aparecem para a borracha) */}
          {tool !== 'eraser' && (
            <div className="flex items-center gap-1.5">
              {(tool === 'pen' ? PEN_COLORS : HIGHLIGHTER_COLORS).map((option) => {
                const selected = color === option
                const swatch = option === 'auto' ? PAPER_STYLES[note.paperTheme].ink : option
                return (
                  <button
                    key={option}
                    type="button"
                    title={option === 'auto' ? 'Automática (preta na folha branca, branca na escura)' : option}
                    aria-label={option === 'auto' ? 'Cor automática' : `Cor ${option}`}
                    aria-pressed={selected}
                    onClick={() => (tool === 'pen' ? setPenColor(option) : setHighlighterColor(option))}
                    className={
                      'h-7 w-7 rounded-full border border-white/20 transition ' +
                      (selected ? 'ring-2 ring-brand ring-offset-2 ring-offset-ink' : 'hover:scale-110')
                    }
                    style={{ backgroundColor: swatch }}
                  />
                )
              })}
            </div>
          )}

          {/* Espessuras */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 p-1">
            {SIZES[tool].map((value, index) => (
              <button
                key={value}
                type="button"
                title={['Fina', 'Média', 'Grossa'][index]}
                aria-label={`Espessura ${['fina', 'média', 'grossa'][index]}`}
                aria-pressed={sizeIndex[tool] === index}
                onClick={() => setSizeIndex((current) => ({ ...current, [tool]: index }))}
                className={
                  'flex h-9 w-9 items-center justify-center rounded-md transition ' +
                  (sizeIndex[tool] === index ? 'bg-white/10' : 'hover:bg-white/5')
                }
              >
                <span className="rounded-full bg-white" style={{ width: 4 + index * 5, height: 4 + index * 5 }} />
              </button>
            ))}
          </div>

          {/* Desfazer / refazer */}
          <div className="flex gap-1">
            <IconButton icon={Undo2} label="Desfazer (Ctrl+Z)" onClick={undo} disabled={history.past.length === 0} />
            <IconButton icon={Redo2} label="Refazer (Ctrl+Y)" onClick={redo} disabled={history.future.length === 0} />
          </div>

          {/* Folhas */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-white/50">
              Folha {activeIndex + 1} de {note.pages.length}
            </span>
            <IconButton icon={FilePlus} label="Adicionar folha depois desta" onClick={addPage} />
            <IconButton
              icon={Trash2}
              label="Remover esta folha"
              onClick={() => setConfirmDeletePage(true)}
              disabled={note.pages.length <= 1}
              danger
            />
          </div>
        </div>

        {actionError && <p className="mt-2 text-sm text-rose-400">{actionError}</p>}
      </div>

      {/* Folhas, uma embaixo da outra */}
      <div className="mx-auto flex max-w-[52rem] flex-col gap-10 px-6 py-8">
        {note.pages.map((page, index) => (
          <div key={page.id} id={`page-${page.id}`} className="scroll-mt-40">
            <PageCanvas
              strokes={page.strokes}
              theme={note.paperTheme}
              tool={tool}
              color={color}
              size={size}
              active={page.id === activePage.id}
              onActivate={() => setActivePageId(page.id)}
              onChange={(strokes) => handleDraw(page, strokes)}
            />
            <p className="mt-2 text-center text-xs text-white/40">
              {index + 1} / {note.pages.length}
            </p>
          </div>
        ))}
      </div>

      {confirmDeletePage && (
        <Modal title="Remover folha" onClose={() => setConfirmDeletePage(false)}>
          <p className="text-sm text-white/70">
            Remover a folha {activeIndex + 1} e tudo o que estiver desenhado nela? Não dá para desfazer.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeletePage(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={deletePage}
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
            >
              Remover
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

type IconButtonProps = {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

function IconButton({ icon: Icon, label, onClick, disabled = false, danger = false }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={
        'rounded-lg p-2 text-white/70 transition hover:bg-white/5 disabled:pointer-events-none disabled:opacity-30 ' +
        (danger ? 'hover:text-rose-400' : 'hover:text-white')
      }
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}
