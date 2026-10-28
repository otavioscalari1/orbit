// Lógica da Lousa: tipos, desenho da folha pautada e dos traços.
// Usada tanto na tela quanto na exportação para PDF (assim o PDF fica igual ao que se vê).

export type PaperTheme = 'light' | 'dark'
export type Tool = 'pen' | 'highlighter' | 'eraser'

export type Stroke = {
  tool: 'pen' | 'highlighter'
  color: string // "auto" (preto na folha branca / branco na escura) ou "#rrggbb"
  size: number // espessura em unidades da folha virtual
  points: number[] // [x1, y1, x2, y2, ...] em unidades da folha virtual
}

export type NoteSummary = {
  id: string
  title: string
  paperTheme: PaperTheme
  pageCount: number
  updatedAt: string
}

export type NotePage = {
  id: string
  position: number
  strokes: Stroke[]
}

export type NoteDetail = {
  id: string
  title: string
  paperTheme: PaperTheme
  pages: NotePage[]
}

// Folha "virtual" com proporção A4 (210 x 297 mm). Os traços são guardados nessas unidades,
// então ficam no lugar certo em qualquer tamanho de tela.
export const PAGE_WIDTH = 1000
export const PAGE_HEIGHT = Math.round((PAGE_WIDTH * 297) / 210) // 1414
const MM = PAGE_WIDTH / 210 // 1 milímetro em unidades da folha

const LINE_SPACING = 8 * MM // pauta de 8 mm
const TOP_MARGIN = 30 * MM
const LEFT_MARGIN = 25 * MM

export const PAPER_STYLES: Record<PaperTheme, { background: string; line: string; margin: string; ink: string }> = {
  light: { background: '#ffffff', line: '#c9d9ea', margin: '#f0a3a3', ink: '#111418' },
  dark: { background: '#1b2027', line: 'rgba(255, 255, 255, 0.09)', margin: 'rgba(90, 209, 236, 0.45)', ink: '#f4f6f8' },
}

// Cores da caneta. "auto" muda junto com a cor da folha.
export const PEN_COLORS = ['auto', '#5ad1ec', '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#9333ea']
export const HIGHLIGHTER_COLORS = ['#fde047', '#86efac', '#7dd3fc', '#f9a8d4', '#fdba74']
export const SIZES: Record<Tool, number[]> = {
  pen: [2, 4, 8],
  highlighter: [16, 26, 40],
  eraser: [12, 24, 48],
}

export function resolveColor(color: string, theme: PaperTheme): string {
  return color === 'auto' ? PAPER_STYLES[theme].ink : color
}

// Desenha a folha inteira (fundo, pauta, margem e traços) num canvas de "width" x "height" pixels
export function drawPage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: PaperTheme,
  strokes: Stroke[],
) {
  const style = PAPER_STYLES[theme]
  const scale = width / PAGE_WIDTH

  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = style.background
  ctx.fillRect(0, 0, width, height)

  // Linhas da pauta
  ctx.strokeStyle = style.line
  ctx.lineWidth = Math.max(1, 1.4 * scale)
  ctx.beginPath()
  for (let y = TOP_MARGIN; y < PAGE_HEIGHT - 10 * MM; y += LINE_SPACING) {
    ctx.moveTo(0, Math.round(y * scale) + 0.5)
    ctx.lineTo(width, Math.round(y * scale) + 0.5)
  }
  ctx.stroke()

  // Linha da margem esquerda
  ctx.strokeStyle = style.margin
  ctx.beginPath()
  ctx.moveTo(Math.round(LEFT_MARGIN * scale) + 0.5, 0)
  ctx.lineTo(Math.round(LEFT_MARGIN * scale) + 0.5, height)
  ctx.stroke()

  for (const stroke of strokes) drawStroke(ctx, stroke, scale, theme)
  ctx.restore()
}

// Desenha um traço suavizado (curvas passando pelo meio dos pontos)
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, scale: number, theme: PaperTheme) {
  const { points } = stroke
  ctx.save()
  ctx.strokeStyle = resolveColor(stroke.color, theme)
  ctx.fillStyle = ctx.strokeStyle
  ctx.lineWidth = stroke.size * scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = 0.4
    // Na folha escura, o marca-texto "clareia" em vez de escurecer
    ctx.globalCompositeOperation = theme === 'light' ? 'multiply' : 'screen'
  }

  if (points.length === 2) {
    // Um toque só vira um ponto
    ctx.beginPath()
    ctx.arc(points[0] * scale, points[1] * scale, (stroke.size * scale) / 2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(points[0] * scale, points[1] * scale)
    for (let i = 2; i < points.length - 2; i += 2) {
      const midX = (points[i] + points[i + 2]) / 2
      const midY = (points[i + 1] + points[i + 3]) / 2
      ctx.quadraticCurveTo(points[i] * scale, points[i + 1] * scale, midX * scale, midY * scale)
    }
    ctx.lineTo(points[points.length - 2] * scale, points[points.length - 1] * scale)
    ctx.stroke()
  }
  ctx.restore()
}

// Borracha: um traço é apagado se algum ponto dele estiver perto do ponto da borracha
export function strokeHitsPoint(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const reach = radius + stroke.size / 2
  const { points } = stroke
  for (let i = 0; i < points.length; i += 2) {
    // Distância até o segmento entre este ponto e o próximo
    const x1 = points[i]
    const y1 = points[i + 1]
    const x2 = points[i + 2] ?? x1
    const y2 = points[i + 3] ?? y1
    const dx = x2 - x1
    const dy = y2 - y1
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared))
    if (Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= reach) return true
  }
  return false
}
