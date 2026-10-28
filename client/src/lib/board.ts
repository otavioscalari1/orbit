// Lógica da Lousa: tipos, desenho da folha pautada, dos elementos (imagens, textos, formas) e dos traços.
// Usada tanto na tela quanto na exportação para PDF (assim o PDF fica igual ao que se vê).

export type PaperTheme = 'light' | 'dark'
export type Tool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'shape'
export type ShapeKind = 'rectangle' | 'ellipse' | 'triangle' | 'line' | 'arrow'

export type Stroke = {
  tool: 'pen' | 'highlighter'
  color: string // "auto" (preto na folha branca / branco na escura) ou "#rrggbb"
  size: number // espessura em unidades da folha virtual
  points: number[] // [x1, y1, x2, y2, ...] em unidades da folha virtual
}

// Elementos editáveis. x/y/w/h em unidades da folha virtual.
// Em linhas e setas, (x, y) é o início e (x + w, y + h) é o fim, então w e h podem ser negativos.
type ElementBase = { id: string; x: number; y: number; w: number; h: number }
export type ImageElement = ElementBase & { type: 'image'; imageId: string }
export type TextElement = ElementBase & { type: 'text'; text: string; color: string; fontSize: number }
export type ShapeElement = ElementBase & { type: 'shape'; shape: ShapeKind; color: string; strokeWidth: number }
export type PageElement = ImageElement | TextElement | ShapeElement

export type PageContent = { strokes: Stroke[]; elements: PageElement[] }

export type NoteSummary = {
  id: string
  title: string
  paperTheme: PaperTheme
  pageCount: number
  updatedAt: string
}

export type NotePage = PageContent & { id: string; position: number }

export type NoteDetail = {
  id: string
  title: string
  paperTheme: PaperTheme
  pages: NotePage[]
}

// Folha "virtual" com proporção A4 (210 x 297 mm). Tudo é guardado nessas unidades,
// então fica no lugar certo em qualquer tamanho de tela.
export const PAGE_WIDTH = 1000
export const PAGE_HEIGHT = Math.round((PAGE_WIDTH * 297) / 210) // 1414
const MM = PAGE_WIDTH / 210 // 1 milímetro em unidades da folha

const LINE_SPACING = 8 * MM // pauta de 8 mm
const TOP_MARGIN = 30 * MM
const LEFT_MARGIN = 25 * MM

export const TEXT_LINE_HEIGHT = 1.3
export const TEXT_FONT_FAMILY = 'Outfit, ui-sans-serif, system-ui, sans-serif'

export const PAPER_STYLES: Record<PaperTheme, { background: string; line: string; margin: string; ink: string }> = {
  light: { background: '#ffffff', line: '#c9d9ea', margin: '#f0a3a3', ink: '#111418' },
  dark: { background: '#1b2027', line: 'rgba(255, 255, 255, 0.09)', margin: 'rgba(90, 209, 236, 0.45)', ink: '#f4f6f8' },
}

// Cores da caneta, do texto e das formas. "auto" muda junto com a cor da folha.
export const PEN_COLORS = ['auto', '#5ad1ec', '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#9333ea']
export const HIGHLIGHTER_COLORS = ['#fde047', '#86efac', '#7dd3fc', '#f9a8d4', '#fdba74']

// Opções de "espessura" de cada ferramenta (no texto, é o tamanho da letra)
export const SIZES: Record<Tool, number[]> = {
  select: [],
  pen: [2, 4, 8],
  highlighter: [16, 26, 40],
  eraser: [12, 24, 48],
  text: [24, 36, 56],
  shape: [3, 6, 10],
}

export function resolveColor(color: string, theme: PaperTheme): string {
  return color === 'auto' ? PAPER_STYLES[theme].ink : color
}

// Retângulo com largura/altura positivas (útil para elementos desenhados "de trás para frente")
export function normalizeBox(el: { x: number; y: number; w: number; h: number }) {
  return {
    x: Math.min(el.x, el.x + el.w),
    y: Math.min(el.y, el.y + el.h),
    w: Math.abs(el.w),
    h: Math.abs(el.h),
  }
}

export const isLineShape = (el: PageElement) => el.type === 'shape' && (el.shape === 'line' || el.shape === 'arrow')

// Quebra o texto em linhas que caibam na largura (o ctx já deve estar com a fonte certa)
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate
      } else {
        lines.push(line)
        line = word
      }
      // Palavra maior que a caixa: quebra no meio
      while (ctx.measureText(line).width > maxWidth && line.length > 1) {
        let cut = line.length - 1
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--
        lines.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
    lines.push(line)
  }
  return lines
}

let measureContext: CanvasRenderingContext2D | null = null

// Altura que um texto ocupa numa caixa de largura "width" (em unidades da folha)
export function measureTextHeight(text: string, width: number, fontSize: number): number {
  measureContext ??= document.createElement('canvas').getContext('2d')
  if (!measureContext) return fontSize * TEXT_LINE_HEIGHT
  measureContext.font = `${fontSize}px ${TEXT_FONT_FAMILY}`
  return wrapText(measureContext, text || ' ', width).length * fontSize * TEXT_LINE_HEIGHT
}

// Busca a imagem de um elemento (já carregada) ou null se ainda não carregou
export type ImageLookup = (imageId: string) => HTMLImageElement | null

type DrawOptions = { hiddenElementId?: string | null }

// Desenha a folha inteira (fundo, pauta, margem, elementos e traços) num canvas de "width" x "height" pixels
export function drawPage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: PaperTheme,
  content: PageContent,
  getImage: ImageLookup,
  options: DrawOptions = {},
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

  // Elementos primeiro e traços por cima (assim dá para escrever sobre uma imagem)
  for (const el of content.elements) {
    if (el.id !== options.hiddenElementId) drawElement(ctx, el, scale, theme, getImage)
  }
  for (const stroke of content.strokes) drawStroke(ctx, stroke, scale, theme)
  ctx.restore()
}

export function drawElement(
  ctx: CanvasRenderingContext2D,
  el: PageElement,
  scale: number,
  theme: PaperTheme,
  getImage: ImageLookup,
) {
  ctx.save()

  if (el.type === 'image') {
    const box = normalizeBox(el)
    const image = getImage(el.imageId)
    if (image && image.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, box.x * scale, box.y * scale, box.w * scale, box.h * scale)
    } else {
      // Enquanto a imagem carrega: um retângulo cinza no lugar dela
      ctx.fillStyle = 'rgba(128, 128, 128, 0.15)'
      ctx.fillRect(box.x * scale, box.y * scale, box.w * scale, box.h * scale)
    }
  } else if (el.type === 'text') {
    const fontSize = el.fontSize * scale
    ctx.font = `${fontSize}px ${TEXT_FONT_FAMILY}`
    ctx.fillStyle = resolveColor(el.color, theme)
    ctx.textBaseline = 'top'
    const lines = wrapText(ctx, el.text, el.w * scale)
    const padding = ((TEXT_LINE_HEIGHT - 1) * fontSize) / 2
    lines.forEach((line, index) => {
      ctx.fillText(line, el.x * scale, el.y * scale + index * fontSize * TEXT_LINE_HEIGHT + padding)
    })
  } else {
    drawShape(ctx, el, scale, theme)
  }

  ctx.restore()
}

function drawShape(ctx: CanvasRenderingContext2D, el: ShapeElement, scale: number, theme: PaperTheme) {
  ctx.strokeStyle = resolveColor(el.color, theme)
  ctx.lineWidth = el.strokeWidth * scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const box = normalizeBox(el)
  const [x, y, w, h] = [box.x * scale, box.y * scale, box.w * scale, box.h * scale]

  ctx.beginPath()
  switch (el.shape) {
    case 'rectangle':
      ctx.rect(x, y, w, h)
      break
    case 'ellipse':
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      break
    case 'triangle':
      ctx.moveTo(x + w / 2, y)
      ctx.lineTo(x + w, y + h)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      break
    case 'line':
    case 'arrow': {
      const startX = el.x * scale
      const startY = el.y * scale
      const endX = (el.x + el.w) * scale
      const endY = (el.y + el.h) * scale
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      if (el.shape === 'arrow' && (el.w !== 0 || el.h !== 0)) {
        // Ponta da seta: duas "abas" a 28° da linha
        const angle = Math.atan2(endY - startY, endX - startX)
        const head = (18 + el.strokeWidth * 3) * scale
        for (const side of [-1, 1]) {
          ctx.moveTo(endX, endY)
          ctx.lineTo(endX - head * Math.cos(angle + side * 0.49), endY - head * Math.sin(angle + side * 0.49))
        }
      }
      break
    }
  }
  ctx.stroke()
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

// Distância de um ponto até um segmento de reta
function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

// Borracha: um traço é apagado se passar perto do ponto da borracha
export function strokeHitsPoint(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const reach = radius + stroke.size / 2
  const { points } = stroke
  for (let i = 0; i < points.length; i += 2) {
    const x2 = points[i + 2] ?? points[i]
    const y2 = points[i + 3] ?? points[i + 1]
    if (distanceToSegment(x, y, points[i], points[i + 1], x2, y2) <= reach) return true
  }
  return false
}

// Seleção: o ponto (x, y) está em cima do elemento?
export function elementHitsPoint(el: PageElement, x: number, y: number): boolean {
  if (el.type === 'shape' && isLineShape(el)) {
    return distanceToSegment(x, y, el.x, el.y, el.x + el.w, el.y + el.h) <= 12 + el.strokeWidth
  }
  const box = normalizeBox(el)
  const tolerance = 6
  return (
    x >= box.x - tolerance && x <= box.x + box.w + tolerance && y >= box.y - tolerance && y <= box.y + box.h + tolerance
  )
}

export type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'start' | 'end'

// Novo tamanho de um elemento ao arrastar uma das alças da seleção até (px, py)
export function resizeElement(original: PageElement, handle: Handle, px: number, py: number): PageElement {
  if (handle === 'start') {
    const endX = original.x + original.w
    const endY = original.y + original.h
    return { ...original, x: px, y: py, w: endX - px, h: endY - py }
  }
  if (handle === 'end') return { ...original, w: px - original.x, h: py - original.y }

  const box = normalizeBox(original)
  // O canto oposto à alça fica parado
  const fixedX = handle === 'nw' || handle === 'sw' ? box.x + box.w : box.x
  const fixedY = handle === 'nw' || handle === 'ne' ? box.y + box.h : box.y
  const MIN = 20
  let w = Math.max(MIN, Math.abs(px - fixedX))
  let h = Math.max(MIN, Math.abs(py - fixedY))

  if (original.type === 'image') {
    // Imagem mantém a proporção
    const ratio = box.w / box.h
    if (w / h > ratio) h = w / ratio
    else w = h * ratio
  }
  if (original.type === 'text') {
    // Texto: só a largura muda; a altura acompanha as linhas
    h = measureTextHeight(original.text, w, original.fontSize)
  }

  const x = px < fixedX ? fixedX - w : fixedX
  const y = original.type === 'text' ? box.y : py < fixedY ? fixedY - h : fixedY
  return { ...original, x, y, w, h }
}
