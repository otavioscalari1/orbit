import { useEffect, useRef } from 'react'

// Saturno desenhado com caracteres ASCII, em 3D, girando devagar.
// A cada quadro, cada "célula" de texto do canvas é tratada como um raio de luz:
// se acertar o planeta ou o anel, calculamos o quanto aquele ponto está iluminado
// e escolhemos um caractere mais "denso" quanto mais claro ele for.

type Vec = [number, number, number]

const RAMP = ' .:-=+*#%@' // do mais escuro (vazio) ao mais claro
const FONT_SIZE = 12
const CELL_WIDTH = FONT_SIZE * 0.62
const CELL_HEIGHT = FONT_SIZE * 1.15
const FPS = 30

const RING_INNER = 1.35 // raios em relação ao raio do planeta (= 1)
const RING_OUTER = 2.3

// Cores do Orbit: planeta branco e anel na cor da marca, igual ao logo
const PLANET_RGB = '255, 255, 255'
const RING_RGB = '90, 209, 236'

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const normalize = (v: Vec): Vec => {
  const length = Math.hypot(v[0], v[1], v[2])
  return [v[0] / length, v[1] / length, v[2] / length]
}

const LIGHT = normalize([-0.65, 0.45, 0.6])

// Faixas do anel, com a "divisão de Cassini" (o vão escuro entre os anéis)
function ringDensity(radius: number): number {
  if (radius < RING_INNER || radius > RING_OUTER) return 0
  if (radius > 1.88 && radius < 1.96) return 0.1
  return 0.55 + 0.2 * Math.sin(radius * 23) + 0.15 * Math.sin(radius * 61)
}

type Star = { col: number; row: number; char: string; phase: number }

function createStars(cols: number, rows: number): Star[] {
  const count = Math.floor(cols * rows * 0.012)
  return Array.from({ length: count }, () => ({
    col: Math.floor(Math.random() * cols),
    row: Math.floor(Math.random() * rows),
    char: Math.random() < 0.8 ? '.' : '+',
    phase: Math.random() * Math.PI * 2,
  }))
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stars: Star[],
  time: number,
) {
  const cols = Math.floor(width / CELL_WIDTH)
  const rows = Math.floor(height / CELL_HEIGHT)
  const centerX = width / 2
  const centerY = height / 2
  // Tamanho do planeta para que planeta + anel caibam na área
  // 1.45 = maior altura que planeta + anel chegam com o movimento abaixo (assim o anel nunca é cortado)
  const scale = Math.min(width / (2 * (RING_OUTER + 0.15)), height / (2 * 1.45))

  // Movimento lento do anel: ele "abre/fecha" (tilt) e inclina para os lados (roll)
  const tilt = 0.38 + 0.14 * Math.sin(time * 0.11)
  const roll = -0.3 + 0.15 * Math.sin(time * 0.07 + 1)
  const axis: Vec = [-Math.sin(roll) * Math.cos(tilt), Math.cos(roll) * Math.cos(tilt), Math.sin(tilt)]
  const east = normalize(cross(axis, [0, 0, 1]))
  const north = cross(axis, east)
  const spin = time * 0.25 // rotação do planeta em torno do próprio eixo
  const lightOnAxis = dot(LIGHT, axis)

  ctx.clearRect(0, 0, width, height)
  ctx.font = `${FONT_SIZE}px "JetBrains Mono", ui-monospace, monospace`
  ctx.textBaseline = 'top'

  const occupied = new Set<number>()

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col * CELL_WIDTH + CELL_WIDTH / 2 - centerX) / scale
      const y = -(row * CELL_HEIGHT + CELL_HEIGHT / 2 - centerY) / scale

      let brightness = 0
      let color = PLANET_RGB
      let depth = -Infinity

      // 1) O raio acerta o planeta?
      const r2 = x * x + y * y
      if (r2 < 1) {
        const z = Math.sqrt(1 - r2)
        const point: Vec = [x, y, z]
        depth = z

        const latitude = Math.asin(dot(point, axis))
        const longitude = Math.atan2(dot(point, north), dot(point, east)) + spin

        // Faixas de nuvens onduladas, que andam com a rotação do planeta
        const bands = 0.72 + 0.28 * Math.sin(latitude * 9 + 0.7 * Math.sin(longitude * 2 + latitude * 3))
        // Uma "tempestade" que deixa a rotação visível
        const stormLon = Math.atan2(Math.sin(longitude - 1), Math.cos(longitude - 1))
        const storm = Math.exp(-(stormLon * stormLon * 6 + (latitude - 0.45) ** 2 * 40))
        const light = 0.12 + 0.88 * Math.max(0, dot(point, LIGHT))
        brightness = light * Math.max(0, bands - storm * 0.45)

        // Sombra do anel projetada no planeta
        if (Math.abs(lightOnAxis) > 0.01) {
          const t = -dot(point, axis) / lightOnAxis
          if (t > 0) {
            const hit: Vec = [point[0] + LIGHT[0] * t, point[1] + LIGHT[1] * t, point[2] + LIGHT[2] * t]
            if (ringDensity(Math.hypot(...hit)) > 0.3) brightness *= 0.45
          }
        }
      }

      // 2) O raio acerta o anel (e ele está na frente do planeta)?
      const ringZ = -(axis[0] * x + axis[1] * y) / axis[2]
      if (ringZ > depth) {
        const density = ringDensity(Math.hypot(x, y, ringZ))
        if (density > 0) {
          const point: Vec = [x, y, ringZ]
          let ringLight = density * (0.45 + 0.55 * Math.abs(lightOnAxis))
          // Sombra do planeta sobre o anel
          const along = dot(point, LIGHT)
          if (along < 0) {
            const distance = Math.hypot(
              point[0] - LIGHT[0] * along,
              point[1] - LIGHT[1] * along,
              point[2] - LIGHT[2] * along,
            )
            if (distance < 1) ringLight *= 0.15
          }
          brightness = ringLight
          color = RING_RGB
          depth = ringZ
        }
      }

      if (depth === -Infinity) continue

      const index = Math.min(RAMP.length - 1, Math.round(brightness * (RAMP.length - 1)))
      if (index === 0) continue
      occupied.add(row * cols + col)
      ctx.fillStyle = `rgba(${color}, ${0.3 + 0.7 * brightness})`
      ctx.fillText(RAMP[index], col * CELL_WIDTH, row * CELL_HEIGHT)
    }
  }

  // Estrelas piscando ao fundo (só onde não tem planeta nem anel)
  for (const star of stars) {
    if (star.col >= cols || star.row >= rows || occupied.has(star.row * cols + star.col)) continue
    const alpha = 0.1 + 0.25 * (0.5 + 0.5 * Math.sin(time * 1.3 + star.phase))
    ctx.fillStyle = `rgba(${PLANET_RGB}, ${alpha})`
    ctx.fillText(star.char, star.col * CELL_WIDTH, star.row * CELL_HEIGHT)
  }
}

export function AsciiSaturn({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!container || !canvas || !ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let stars: Star[] = []
    let frameId = 0
    let lastDraw = 0
    const startedAt = performance.now()

    // Ajusta o canvas ao tamanho do container (e à densidade de pixels da tela)
    function resize() {
      const rect = container!.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const ratio = window.devicePixelRatio || 1
      canvas!.width = Math.round(width * ratio)
      canvas!.height = Math.round(height * ratio)
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0)
      stars = createStars(Math.floor(width / CELL_WIDTH), Math.floor(height / CELL_HEIGHT))
      drawFrame(ctx!, width, height, stars, (performance.now() - startedAt) / 1000)
    }

    function loop(now: number) {
      frameId = requestAnimationFrame(loop)
      if (now - lastDraw < 1000 / FPS) return
      lastDraw = now
      drawFrame(ctx!, width, height, stars, (now - startedAt) / 1000)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    // Quem prefere menos movimento (configuração do sistema) vê o Saturno parado
    if (!reducedMotion) frameId = requestAnimationFrame(loop)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <div ref={containerRef} className={'relative ' + className}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
    </div>
  )
}
