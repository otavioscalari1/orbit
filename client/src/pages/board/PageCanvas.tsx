import { useEffect, useRef, type PointerEvent } from 'react'
import {
  drawPage,
  drawStroke,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  strokeHitsPoint,
  type PaperTheme,
  type Stroke,
  type Tool,
} from '../../lib/board'

type PageCanvasProps = {
  strokes: Stroke[]
  theme: PaperTheme
  tool: Tool
  color: string
  size: number
  active: boolean
  onActivate: () => void
  onChange: (strokes: Stroke[]) => void // chamado ao terminar um traço ou uma passada de borracha
}

// Uma folha A4 desenhável. Funciona com mouse, caneta (tablet) e dedo.
export function PageCanvas({ strokes, theme, tool, color, size, active, onActivate, onChange }: PageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Estado do gesto atual (fica em ref para não redesenhar o React a cada movimento do mouse)
  const liveStroke = useRef<Stroke | null>(null)
  const erasing = useRef<{ remaining: Stroke[]; changed: boolean } | null>(null)
  const pixelSize = useRef({ width: 0, height: 0 })

  // Redesenha a folha com o que está salvo + o gesto em andamento
  function redraw() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || pixelSize.current.width === 0) return
    const { width, height } = pixelSize.current
    const visible = erasing.current ? erasing.current.remaining : strokes
    drawPage(ctx, width, height, theme, visible)
    if (liveStroke.current) drawStroke(ctx, liveStroke.current, width / PAGE_WIDTH, theme)
  }

  // Guarda sempre a versão mais nova de redraw (com os traços atuais) para o ResizeObserver usar
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
      redrawRef.current()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Redesenha quando os traços salvos ou a cor da folha mudarem
  useEffect(redraw)

  // Posição do ponteiro em unidades da folha virtual
  function toPagePoint(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * PAGE_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * PAGE_HEIGHT,
    }
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

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return
    onActivate()
    event.currentTarget.setPointerCapture(event.pointerId)
    const { x, y } = toPagePoint(event)

    if (tool === 'eraser') {
      erasing.current = { remaining: strokes, changed: false }
      eraseAt(x, y)
    } else {
      liveStroke.current = { tool, color, size, points: [round(x), round(y)] }
    }
    redraw()
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!liveStroke.current && !erasing.current) return
    // Eventos "agrupados" dão um traço mais suave em mouses/canetas rápidos
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent]
    const rect = event.currentTarget.getBoundingClientRect()

    for (const native of events) {
      const x = ((native.clientX - rect.left) / rect.width) * PAGE_WIDTH
      const y = ((native.clientY - rect.top) / rect.height) * PAGE_HEIGHT
      if (erasing.current) {
        eraseAt(x, y)
      } else if (liveStroke.current) {
        const points = liveStroke.current.points
        const lastX = points[points.length - 2]
        const lastY = points[points.length - 1]
        // Ignora movimentos minúsculos para não guardar pontos demais
        if (Math.hypot(x - lastX, y - lastY) >= 1.5) points.push(round(x), round(y))
      }
    }
    redraw()
  }

  function handlePointerUp() {
    if (liveStroke.current) {
      const finished = liveStroke.current
      liveStroke.current = null
      onChange([...strokes, finished])
    } else if (erasing.current) {
      const { remaining, changed } = erasing.current
      erasing.current = null
      if (changed) onChange(remaining)
      else redraw()
    }
  }

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
        className={'absolute inset-0 h-full w-full touch-none ' + (tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair')}
      />
    </div>
  )
}

// Arredonda para 1 casa decimal (deixa o JSON salvo menor sem perder precisão visível)
function round(value: number) {
  return Math.round(value * 10) / 10
}
