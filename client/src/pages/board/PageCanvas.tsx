import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  drawPage,
  drawStroke,
  elementHitsPoint,
  isLineShape,
  measureTextHeight,
  normalizeBox,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  resizeElement,
  resolveColor,
  strokeHitsPoint,
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
  type Handle,
  type PageContent,
  type PageElement,
  type PaperTheme,
  type ShapeKind,
  type Stroke,
  type TextElement,
  type Tool,
} from '../../lib/board'
import { getNoteImage } from '../../lib/noteImages'

type PageCanvasProps = {
  noteId: string
  content: PageContent
  theme: PaperTheme
  tool: Tool
  shapeKind: ShapeKind
  color: string
  size: number
  active: boolean
  selectedId: string | null
  onActivate: () => void
  onSelect: (elementId: string | null) => void
  onChange: (content: PageContent) => void // chamado ao terminar cada ação (traço, mover, redimensionar...)
  onToolChange: (tool: Tool) => void
}

// Gesto em andamento com o ponteiro (mouse, caneta ou dedo)
type Gesture =
  | { kind: 'move'; original: PageElement; startX: number; startY: number }
  | { kind: 'create'; startX: number; startY: number }
  | { kind: 'resize'; original: PageElement; handle: Handle }

// Uma folha A4 com desenho à mão, imagens, textos e formas.
export function PageCanvas(props: PageCanvasProps) {
  const { noteId, content, theme, tool, shapeKind, color, size, active, selectedId } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pixelSize = useRef({ width: 0, height: 0 })
  // Traço/borracha em andamento ficam em ref (não precisam re-renderizar o React a cada movimento)
  const liveStroke = useRef<Stroke | null>(null)
  const erasing = useRef<{ remaining: Stroke[]; changed: boolean } | null>(null)
  const gesture = useRef<Gesture | null>(null)
  // Elemento sendo criado, movido, redimensionado ou editado (ainda não confirmado)
  const [draft, setDraft] = useState<PageElement | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Texto em edição também fica em ref: garante que "terminar a edição" rode uma vez só,
  // mesmo quando o clique fora e a perda de foco acontecem juntos
  const editingText = useRef<TextElement | null>(null)
  const [cssWidth, setCssWidth] = useState(0)

  // Elementos visíveis = salvos, com o rascunho no lugar (ou no fim, se for novo)
  const elements = draft
    ? content.elements.some((el) => el.id === draft.id)
      ? content.elements.map((el) => (el.id === draft.id ? draft : el))
      : [...content.elements, draft]
    : content.elements

  function redraw() {
    const ctx = canvasRef.current?.getContext('2d')
    const { width, height } = pixelSize.current
    if (!ctx || width === 0) return
    const strokes = erasing.current ? erasing.current.remaining : content.strokes
    drawPage(
      ctx,
      width,
      height,
      theme,
      { strokes, elements },
      (imageId) => getNoteImage(noteId, imageId, () => redrawRef.current()),
      { hiddenElementId: editingId },
    )
    if (liveStroke.current) drawStroke(ctx, liveStroke.current, width / PAGE_WIDTH, theme)
  }

  // Guarda sempre a versão mais nova de redraw para quem é chamado "de fora" (resize, imagem carregada)
  const redrawRef = useRef(redraw)
  redrawRef.current = redraw

  // Ajusta o canvas ao tamanho da tela (e à densidade de pixels) sempre que o container mudar
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const observer = new ResizeObserver(() => {
      const ratio = window.devicePixelRatio || 1
      const width = Math.round(container.clientWidth * ratio)
      const height = Math.round((width * PAGE_HEIGHT) / PAGE_WIDTH)
      canvas.width = width
      canvas.height = height
      pixelSize.current = { width, height }
      setCssWidth(container.clientWidth)
      redrawRef.current()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(redraw)

  // Se a seleção sair deste elemento enquanto edita o texto, termina a edição
  useEffect(() => {
    if (editingText.current && selectedId !== editingText.current.id) finishEditing()
  })

  // Posição do ponteiro em unidades da folha virtual
  function toPagePoint(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * PAGE_WIDTH,
      y: ((clientY - rect.top) / rect.height) * PAGE_HEIGHT,
    }
  }

  function topElementAt(x: number, y: number): PageElement | undefined {
    return [...content.elements].reverse().find((el) => elementHitsPoint(el, x, y))
  }

  function commitElements(next: PageElement[]) {
    props.onChange({ strokes: content.strokes, elements: next })
  }

  function replaceElement(updated: PageElement) {
    const exists = content.elements.some((el) => el.id === updated.id)
    commitElements(exists ? content.elements.map((el) => (el.id === updated.id ? updated : el)) : [...content.elements, updated])
  }

  // ---- Texto ----

  function startEditing(el: TextElement) {
    editingText.current = el
    setDraft(el)
    setEditingId(el.id)
    props.onSelect(el.id)
  }

  function updateEditingText(text: string) {
    const current = editingText.current
    if (!current) return
    const updated = { ...current, text, h: measureTextHeight(text, current.w, current.fontSize) }
    editingText.current = updated
    setDraft(updated)
  }

  function finishEditing() {
    const current = editingText.current
    editingText.current = null
    if (!current) return
    setEditingId(null)
    setDraft(null)
    const existed = content.elements.some((el) => el.id === current.id)
    if (!current.text.trim()) {
      // Caixa vazia: some (se já existia, é removida)
      if (existed) commitElements(content.elements.filter((el) => el.id !== current.id))
      props.onSelect(null)
      return
    }
    const original = content.elements.find((el) => el.id === current.id)
    if (!original || JSON.stringify(original) !== JSON.stringify(current)) replaceElement(current)
  }

  // ---- Ponteiro no canvas ----

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return
    // Impede o navegador de mudar o foco sozinho; a edição de texto é encerrada aqui, de forma controlada
    event.preventDefault()
    finishEditing()
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    props.onActivate()
    const { x, y } = toPagePoint(event.clientX, event.clientY)

    if (tool === 'select') {
      const hit = topElementAt(x, y)
      props.onSelect(hit?.id ?? null)
      if (hit) {
        event.currentTarget.setPointerCapture(event.pointerId)
        gesture.current = { kind: 'move', original: hit, startX: x, startY: y }
      }
      return
    }

    if (tool === 'text') {
      const existing = topElementAt(x, y)
      if (existing?.type === 'text') return startEditing(existing)
      const width = Math.min(420, PAGE_WIDTH - 20 - x)
      startEditing({
        id: crypto.randomUUID(),
        type: 'text',
        x,
        y: y - size * 0.65,
        w: Math.max(120, width),
        h: size * TEXT_LINE_HEIGHT,
        text: '',
        color,
        fontSize: size,
      })
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)

    if (tool === 'shape') {
      gesture.current = { kind: 'create', startX: x, startY: y }
      setDraft({ id: crypto.randomUUID(), type: 'shape', shape: shapeKind, x, y, w: 0, h: 0, color, strokeWidth: size })
      return
    }

    if (tool === 'eraser') {
      erasing.current = { remaining: content.strokes, changed: false }
      eraseAt(x, y)
    } else {
      liveStroke.current = { tool, color, size, points: [round(x), round(y)] }
    }
    redraw()
  }

  function eraseAt(x: number, y: number) {
    const state = erasing.current
    if (!state) return
    const remaining = state.remaining.filter((stroke) => !strokeHitsPoint(stroke, x, y, size / 2))
    if (remaining.length !== state.remaining.length) {
      state.remaining = remaining
      state.changed = true
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const current = gesture.current
    if (current?.kind === 'move') {
      const { x, y } = toPagePoint(event.clientX, event.clientY)
      setDraft({ ...current.original, x: current.original.x + x - current.startX, y: current.original.y + y - current.startY })
      return
    }
    if (current?.kind === 'create') {
      const { x, y } = toPagePoint(event.clientX, event.clientY)
      setDraft((d) => d && { ...d, w: x - current.startX, h: y - current.startY })
      return
    }
    if (!liveStroke.current && !erasing.current) return

    // Eventos "agrupados" dão um traço mais suave em mouses/canetas rápidos
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent]
    for (const native of events) {
      const { x, y } = toPagePoint(native.clientX, native.clientY)
      if (erasing.current) {
        eraseAt(x, y)
      } else if (liveStroke.current) {
        const points = liveStroke.current.points
        // Ignora movimentos minúsculos para não guardar pontos demais
        if (Math.hypot(x - points[points.length - 2], y - points[points.length - 1]) >= 1.5) {
          points.push(round(x), round(y))
        }
      }
    }
    redraw()
  }

  function handlePointerUp() {
    const current = gesture.current
    gesture.current = null

    if (current?.kind === 'move') {
      if (draft && (draft.x !== current.original.x || draft.y !== current.original.y)) replaceElement(draft)
      setDraft(null)
      return
    }

    if (current?.kind === 'create' && draft?.type === 'shape') {
      let shape = draft
      // Só um clique (sem arrastar): cria a forma num tamanho padrão
      if (Math.abs(shape.w) < 10 && Math.abs(shape.h) < 10) {
        const isLine = shape.shape === 'line' || shape.shape === 'arrow'
        const side = shape.shape === 'ellipse' ? 160 : 200
        shape = { ...shape, w: isLine ? 220 : side, h: isLine ? 0 : shape.shape === 'ellipse' ? 160 : 140 }
      }
      if (!isLineShape(shape)) shape = { ...shape, ...normalizeBox(shape) }
      setDraft(null)
      replaceElement(shape)
      props.onSelect(shape.id)
      props.onToolChange('select')
      return
    }

    if (liveStroke.current) {
      const finished = liveStroke.current
      liveStroke.current = null
      props.onChange({ strokes: [...content.strokes, finished], elements: content.elements })
    } else if (erasing.current) {
      const { remaining, changed } = erasing.current
      erasing.current = null
      if (changed) props.onChange({ strokes: remaining, elements: content.elements })
      else redraw()
    }
  }

  function handleDoubleClick(event: ReactMouseEvent<HTMLCanvasElement>) {
    if (tool !== 'select') return
    const { x, y } = toPagePoint(event.clientX, event.clientY)
    const hit = topElementAt(x, y)
    if (hit?.type === 'text') startEditing(hit)
  }

  // ---- Alças de redimensionar ----

  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>, el: PageElement, handle: Handle) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { kind: 'resize', original: el, handle }
  }

  function handleResizeMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current
    if (current?.kind !== 'resize') return
    const { x, y } = toPagePoint(event.clientX, event.clientY)
    setDraft(resizeElement(current.original, current.handle, x, y))
  }

  function handleResizeEnd() {
    const current = gesture.current
    gesture.current = null
    if (current?.kind === 'resize' && draft) replaceElement(draft)
    setDraft(null)
  }

  // ---- Interface por cima do canvas (seleção e caixa de texto) ----

  const scaleCss = cssWidth / PAGE_WIDTH
  const selected = selectedId ? elements.find((el) => el.id === selectedId) : undefined
  const editing = editingId && draft?.type === 'text' && draft.id === editingId ? draft : null
  const percentX = (value: number) => `${(value / PAGE_WIDTH) * 100}%`
  const percentY = (value: number) => `${(value / PAGE_HEIGHT) * 100}%`

  const handles: { handle: Handle; x: number; y: number; cursor: string }[] = []
  if (selected && !editing) {
    if (isLineShape(selected)) {
      handles.push({ handle: 'start', x: selected.x, y: selected.y, cursor: 'move' })
      handles.push({ handle: 'end', x: selected.x + selected.w, y: selected.y + selected.h, cursor: 'move' })
    } else {
      const box = normalizeBox(selected)
      handles.push({ handle: 'nw', x: box.x, y: box.y, cursor: 'nwse-resize' })
      handles.push({ handle: 'ne', x: box.x + box.w, y: box.y, cursor: 'nesw-resize' })
      handles.push({ handle: 'sw', x: box.x, y: box.y + box.h, cursor: 'nesw-resize' })
      handles.push({ handle: 'se', x: box.x + box.w, y: box.y + box.h, cursor: 'nwse-resize' })
    }
  }

  const cursor =
    tool === 'eraser' ? 'cursor-cell' : tool === 'text' ? 'cursor-text' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair'

  return (
    <div
      ref={containerRef}
      className={
        'relative w-full overflow-hidden rounded-sm shadow-xl transition ' +
        (active ? 'ring-2 ring-brand ring-offset-4 ring-offset-ink' : 'ring-1 ring-white/10')
      }
      style={{ aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}` }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className={'absolute inset-0 h-full w-full touch-none ' + cursor}
      />

      {/* Contorno do elemento selecionado */}
      {selected && !editing && !isLineShape(selected) && (
        <div
          className="pointer-events-none absolute border border-dashed border-brand"
          style={{
            left: percentX(normalizeBox(selected).x),
            top: percentY(normalizeBox(selected).y),
            width: percentX(normalizeBox(selected).w),
            height: percentY(normalizeBox(selected).h),
          }}
        />
      )}

      {/* Alças para redimensionar (ou mover as pontas da linha/seta) */}
      {handles.map(({ handle, x, y, cursor: handleCursor }) => (
        <div
          key={handle}
          onPointerDown={(event) => handleResizeStart(event, selected!, handle)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-brand bg-white"
          style={{ left: percentX(x), top: percentY(y), cursor: handleCursor }}
        />
      ))}

      {/* Caixa de texto em edição */}
      {editing && (
        <textarea
          key={editing.id}
          autoFocus
          value={editing.text}
          placeholder="Digite aqui..."
          onChange={(event) => updateEditingText(event.target.value)}
          onBlur={finishEditing}
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.currentTarget.blur()
          }}
          className="absolute resize-none overflow-hidden border border-dashed border-brand bg-transparent p-0 outline-none placeholder:opacity-40"
          style={{
            left: percentX(editing.x),
            top: percentY(editing.y),
            width: percentX(editing.w),
            height: `${Math.max(editing.h, editing.fontSize * TEXT_LINE_HEIGHT) * scaleCss}px`,
            fontFamily: TEXT_FONT_FAMILY,
            fontSize: `${editing.fontSize * scaleCss}px`,
            lineHeight: TEXT_LINE_HEIGHT,
            color: resolveColor(editing.color, theme),
          }}
        />
      )}
    </div>
  )
}

// Arredonda para 1 casa decimal (deixa o JSON salvo menor sem perder precisão visível)
function round(value: number) {
  return Math.round(value * 10) / 10
}
