import {
  ArrowLeft,
  Circle,
  Download,
  Eraser,
  FilePlus,
  Highlighter,
  ImagePlus,
  Minus,
  Moon,
  MousePointer2,
  MoveUpRight,
  PenLine,
  Redo2,
  Shapes,
  Square,
  Sun,
  Trash2,
  Triangle,
  Type,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import {
  HIGHLIGHTER_COLORS,
  measureTextHeight,
  PAGE_WIDTH,
  PAPER_STYLES,
  PEN_COLORS,
  SIZES,
  type NoteDetail,
  type NotePage,
  type PageContent,
  type PageElement,
  type PaperTheme,
  type ShapeKind,
  type Tool,
} from '../../lib/board'
import { exportNoteToPdf } from '../../lib/exportPdf'
import { prepareImage } from '../../lib/noteImages'
import { PageCanvas } from './PageCanvas'

const SAVE_DELAY = 700 // ms sem mexer antes de salvar a folha no banco
const IMAGE_MAX_WIDTH = 600 // largura máxima de uma imagem ao entrar na folha (de 1000)

type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'
type HistoryEntry = { pageId: string; before: PageContent; after: PageContent }
type Selection = { pageId: string; elementId: string } | null

const TOOLS: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: 'select', label: 'Selecionar e mover', icon: MousePointer2 },
  { id: 'pen', label: 'Caneta', icon: PenLine },
  { id: 'highlighter', label: 'Marca-texto', icon: Highlighter },
  { id: 'eraser', label: 'Borracha (apaga o traço inteiro)', icon: Eraser },
  { id: 'text', label: 'Caixa de texto', icon: Type },
  { id: 'shape', label: 'Formas', icon: Shapes },
]

const SHAPES: { id: ShapeKind; label: string; icon: LucideIcon }[] = [
  { id: 'arrow', label: 'Seta', icon: MoveUpRight },
  { id: 'line', label: 'Linha', icon: Minus },
  { id: 'rectangle', label: 'Quadrado / retângulo', icon: Square },
  { id: 'ellipse', label: 'Círculo / elipse', icon: Circle },
  { id: 'triangle', label: 'Triângulo', icon: Triangle },
]

const SIZE_LABELS: Partial<Record<Tool, string[]>> = {
  text: ['Letra pequena', 'Letra média', 'Letra grande'],
}

const contentOf = (page: NotePage): PageContent => ({ strokes: page.strokes, elements: page.elements })

export function NoteEditorPage() {
  const { noteId = '' } = useParams()
  const [note, setNote] = useState<NoteDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [shapeKind, setShapeKind] = useState<ShapeKind>('arrow')
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [highlighterColor, setHighlighterColor] = useState(HIGHLIGHTER_COLORS[0])
  const [sizeIndex, setSizeIndex] = useState<Record<Tool, number>>({
    select: 0,
    pen: 1,
    highlighter: 1,
    eraser: 1,
    text: 1,
    shape: 1,
  })
  const [selection, setSelection] = useState<Selection>(null)
  const [history, setHistory] = useState<{ past: HistoryEntry[]; future: HistoryEntry[] }>({ past: [], future: [] })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [actionError, setActionError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmDeletePage, setConfirmDeletePage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Versão mais nova da anotação, para ações que terminam depois de esperar o servidor (ex.: enviar imagem)
  const noteRef = useRef(note)
  noteRef.current = note

  // Salvamentos agendados por folha (para juntar várias alterações seguidas num salvamento só)
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pendingContent = useRef(new Map<string, PageContent>())

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
      const content = pendingContent.current.get(pageId)
      saveTimers.current.delete(pageId)
      if (!content) return
      pendingContent.current.delete(pageId)
      setSaveStatus('saving')
      try {
        await api.saveNotePage(noteId, pageId, content)
        setSaveStatus(pendingContent.current.size > 0 ? 'pending' : 'saved')
      } catch {
        // Devolve para a fila: tenta de novo na próxima alteração
        if (!pendingContent.current.has(pageId)) pendingContent.current.set(pageId, content)
        setSaveStatus('error')
      }
    },
    [noteId],
  )

  function scheduleSave(pageId: string, content: PageContent) {
    pendingContent.current.set(pageId, content)
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
      if (pendingContent.current.size > 0) event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      flushSaves()
    }
  }, [flushSaves])

  function setPageContent(pageId: string, content: PageContent) {
    setNote((current) =>
      current && {
        ...current,
        pages: current.pages.map((page) => (page.id === pageId ? { ...page, ...content } : page)),
      },
    )
    scheduleSave(pageId, content)
  }

  // Toda alteração feita pelo usuário passa por aqui (entra no histórico de desfazer)
  function changePage(pageId: string, content: PageContent) {
    const page = noteRef.current?.pages.find((p) => p.id === pageId)
    if (!page) return
    setHistory(({ past }) => ({ past: [...past, { pageId, before: contentOf(page), after: content }], future: [] }))
    setPageContent(pageId, content)
  }

  function undo() {
    const entry = history.past[history.past.length - 1]
    if (!entry) return
    setHistory(({ past, future }) => ({ past: past.slice(0, -1), future: [entry, ...future] }))
    setPageContent(entry.pageId, entry.before)
    setActivePageId(entry.pageId)
    setSelection(null)
  }

  function redo() {
    const entry = history.future[0]
    if (!entry) return
    setHistory(({ past, future }) => ({ past: [...past, entry], future: future.slice(1) }))
    setPageContent(entry.pageId, entry.after)
    setActivePageId(entry.pageId)
    setSelection(null)
  }

  const selectedPage = selection ? note?.pages.find((page) => page.id === selection.pageId) : undefined
  const selectedElement = selectedPage?.elements.find((el) => el.id === selection?.elementId)

  function updateSelectedElement(update: (el: PageElement) => PageElement) {
    if (!selectedPage || !selectedElement) return
    changePage(selectedPage.id, {
      ...contentOf(selectedPage),
      elements: selectedPage.elements.map((el) => (el.id === selectedElement.id ? update(el) : el)),
    })
  }

  function deleteSelectedElement() {
    if (!selectedPage || !selectedElement) return
    changePage(selectedPage.id, {
      ...contentOf(selectedPage),
      elements: selectedPage.elements.filter((el) => el.id !== selectedElement.id),
    })
    setSelection(null)
  }

  // Atalhos: Ctrl+Z desfaz, Ctrl+Y / Ctrl+Shift+Z refaz, Delete apaga o elemento selecionado
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const key = event.key.toLowerCase()
      if ((key === 'delete' || key === 'backspace') && selectedElement) {
        event.preventDefault()
        deleteSelectedElement()
      } else if (key === 'escape') {
        setSelection(null)
      } else if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if ((event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  // Ctrl+V: cola uma imagem copiada (print, imagem de site...) na folha ativa
  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement
      if (!noteRef.current || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (!file) return
      event.preventDefault()
      insertImage(file)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
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

  // Cor e tamanho mostrados na barra: os do elemento selecionado (se tiver) ou os da ferramenta
  const formatTarget: Tool | null =
    selectedElement?.type === 'text' ? 'text' : selectedElement?.type === 'shape' ? 'shape' : tool === 'select' ? null : tool
  const color = tool === 'highlighter' ? highlighterColor : penColor
  const size = SIZES[tool][sizeIndex[tool]] ?? 0
  const shownColor =
    selectedElement && selectedElement.type !== 'image' ? selectedElement.color : formatTarget === 'highlighter' ? highlighterColor : penColor
  const shownSizeIndex = (() => {
    if (selectedElement?.type === 'text') return SIZES.text.indexOf(selectedElement.fontSize)
    if (selectedElement?.type === 'shape') return SIZES.shape.indexOf(selectedElement.strokeWidth)
    return formatTarget ? sizeIndex[formatTarget] : -1
  })()

  function pickColor(option: string) {
    if (formatTarget === 'highlighter') setHighlighterColor(option)
    else setPenColor(option)
    if (selectedElement && selectedElement.type !== 'image') updateSelectedElement((el) => ({ ...el, color: option }))
  }

  function pickSize(index: number) {
    if (!formatTarget) return
    setSizeIndex((current) => ({ ...current, [formatTarget]: index }))
    const value = SIZES[formatTarget][index]
    if (selectedElement?.type === 'text') {
      updateSelectedElement((el) =>
        el.type === 'text' ? { ...el, fontSize: value, h: measureTextHeight(el.text, el.w, value) } : el,
      )
    } else if (selectedElement?.type === 'shape') {
      updateSelectedElement((el) => (el.type === 'shape' ? { ...el, strokeWidth: value } : el))
    }
  }

  function chooseTool(id: Tool) {
    setTool(id)
    if (id !== 'select') setSelection(null)
  }

  // Prepara, envia e coloca uma imagem no meio da folha ativa
  function insertImage(file: Blob) {
    const pageId = activePage.id
    setUploading(true)
    runAction(async () => {
      try {
        const { blob, width, height } = await prepareImage(file)
        const { id: imageId } = await api.uploadNoteImage(note!.id, blob)
        // Pega a folha de novo: o usuário pode ter desenhado enquanto a imagem subia
        const page = noteRef.current?.pages.find((p) => p.id === pageId)
        if (!page) return
        const w = Math.min(IMAGE_MAX_WIDTH, width)
        const h = (w * height) / width
        const element: PageElement = {
          id: crypto.randomUUID(),
          type: 'image',
          imageId,
          x: (PAGE_WIDTH - w) / 2,
          y: 160,
          w,
          h,
        }
        changePage(page.id, { ...contentOf(page), elements: [...page.elements, element] })
        setActivePageId(page.id)
        setTool('select')
        setSelection({ pageId: page.id, elementId: element.id })
      } finally {
        setUploading(false)
      }
    })
  }

  function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // permite escolher o mesmo arquivo de novo depois
    if (file) insertImage(file)
  }

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
      pendingContent.current.delete(removed.id)
      await api.deleteNotePage(note!.id, removed.id)
      const remaining = note!.pages
        .filter((page) => page.id !== removed.id)
        .map((page) => (page.position > removed.position ? { ...page, position: page.position - 1 } : page))
      setNote({ ...note!, pages: remaining })
      setActivePageId(remaining[Math.min(activeIndex, remaining.length - 1)]?.id ?? null)
      if (selection?.pageId === removed.id) setSelection(null)
      // O histórico daquela folha não faz mais sentido
      setHistory(({ past, future }) => ({
        past: past.filter((entry) => entry.pageId !== removed.id),
        future: future.filter((entry) => entry.pageId !== removed.id),
      }))
      setConfirmDeletePage(false)
      if (pendingContent.current.size === 0) setSaveStatus('saved')
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
    runAction(() => exportNoteToPdf({ ...note!, title: title.trim() || note!.title }))
  }

  const saveLabel: Record<SaveStatus, string> = {
    saved: 'Salvo',
    pending: 'Alterações não salvas...',
    saving: 'Salvando...',
    error: 'Erro ao salvar — continue editando para tentar de novo',
  }

  const colorOptions = formatTarget === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS
  const showColors = formatTarget !== null && formatTarget !== 'eraser'

  return (
    // -m-6 anula o espaçamento da área principal: a barra encosta no topo e só as folhas rolam
    <div className="-m-6 flex h-[calc(100%+3rem)] flex-col">
      {/* Barra de ferramentas fixa no topo (fora da área que rola) */}
      <div className="z-20 shrink-0 border-b border-white/10 bg-ink px-6 py-2">
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
            {uploading ? 'Enviando imagem...' : saveLabel[saveStatus]}
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Importar imagem (ou cole com Ctrl+V)"
            className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium transition hover:border-brand hover:text-brand disabled:opacity-40"
          >
            <ImagePlus className="h-4 w-4" />
            Importar imagem
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChosen}
            className="hidden"
          />
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

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* Ferramentas */}
          <div className="flex gap-1 rounded-lg border border-white/10 p-1">
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={tool === id}
                onClick={() => chooseTool(id)}
                className={
                  'rounded-md p-2 transition ' +
                  (tool === id ? 'bg-brand text-ink' : 'text-white/70 hover:bg-white/5 hover:text-white')
                }
              >
                <Icon className="h-5 w-5" />
              </button>
            ))}
          </div>

          {/* Formas prontas (aparecem com a ferramenta Formas) */}
          {tool === 'shape' && (
            <div className="flex gap-1 rounded-lg border border-white/10 p-1">
              {SHAPES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  title={`${label} (clique ou arraste na folha)`}
                  aria-label={label}
                  aria-pressed={shapeKind === id}
                  onClick={() => setShapeKind(id)}
                  className={
                    'rounded-md p-2 transition ' +
                    (shapeKind === id ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')
                  }
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          )}

          {/* Cores */}
          {showColors && (
            <div className="flex items-center gap-1.5">
              {colorOptions.map((option) => {
                const swatch = option === 'auto' ? PAPER_STYLES[note.paperTheme].ink : option
                return (
                  <button
                    key={option}
                    type="button"
                    title={option === 'auto' ? 'Automática (preta na folha branca, branca na escura)' : option}
                    aria-label={option === 'auto' ? 'Cor automática' : `Cor ${option}`}
                    aria-pressed={shownColor === option}
                    onClick={() => pickColor(option)}
                    className={
                      'h-7 w-7 rounded-full border border-white/20 transition ' +
                      (shownColor === option ? 'ring-2 ring-brand ring-offset-2 ring-offset-ink' : 'hover:scale-110')
                    }
                    style={{ backgroundColor: swatch }}
                  />
                )
              })}
            </div>
          )}

          {/* Espessuras (no texto: tamanho da letra) */}
          {formatTarget && (
            <div className="flex items-center gap-1 rounded-lg border border-white/10 p-1">
              {SIZES[formatTarget].map((value, index) => {
                const label = SIZE_LABELS[formatTarget]?.[index] ?? ['Fina', 'Média', 'Grossa'][index]
                return (
                  <button
                    key={value}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={shownSizeIndex === index}
                    onClick={() => pickSize(index)}
                    className={
                      'flex h-9 w-9 items-center justify-center rounded-md transition ' +
                      (shownSizeIndex === index ? 'bg-white/10' : 'hover:bg-white/5')
                    }
                  >
                    {formatTarget === 'text' ? (
                      <span className="font-semibold" style={{ fontSize: 11 + index * 4 }}>
                        A
                      </span>
                    ) : (
                      <span className="rounded-full bg-white" style={{ width: 4 + index * 5, height: 4 + index * 5 }} />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Elemento selecionado: apagar */}
          {selectedElement && (
            <div className="flex items-center gap-1 rounded-lg border border-brand/40 py-1 pr-1 pl-3 text-sm text-white/70">
              {{ image: 'Imagem', text: 'Texto', shape: 'Forma' }[selectedElement.type]} selecionada
              <IconButton icon={Trash2} label="Apagar (Delete)" onClick={deleteSelectedElement} danger />
              <IconButton icon={X} label="Tirar seleção (Esc)" onClick={() => setSelection(null)} />
            </div>
          )}

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

      {/* Folhas, uma embaixo da outra (só esta área rola) */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[52rem] flex-col gap-10 px-6 py-8">
          {note.pages.map((page, index) => (
            <div key={page.id} id={`page-${page.id}`} className="scroll-mt-8">
              <PageCanvas
                noteId={note.id}
                content={contentOf(page)}
                theme={note.paperTheme}
                tool={tool}
                shapeKind={shapeKind}
                color={color}
                size={size}
                active={page.id === activePage.id}
                selectedId={selection?.pageId === page.id ? selection.elementId : null}
                onActivate={() => setActivePageId(page.id)}
                onSelect={(elementId) => setSelection(elementId ? { pageId: page.id, elementId } : null)}
                onChange={(content) => changePage(page.id, content)}
                onToolChange={chooseTool}
              />
              <p className="mt-2 text-center text-xs text-white/40">
                {index + 1} / {note.pages.length}
              </p>
            </div>
          ))}
        </div>
      </div>

      {confirmDeletePage && (
        <Modal title="Remover folha" onClose={() => setConfirmDeletePage(false)}>
          <p className="text-sm text-white/70">
            Remover a folha {activeIndex + 1} e tudo o que estiver nela? Não dá para desfazer.
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
