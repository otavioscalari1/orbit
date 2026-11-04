import { useRef, useState, type PointerEvent } from 'react'
import { Modal } from '../../components/Modal'

const FRAME_SIZE = 280 // tamanho do quadro na tela, em px
const OUTPUT_SIZE = 600 // tamanho da foto final, em px: suficiente para imprimir sem pesar no PDF
const MAX_ZOOM = 3

type Offset = { x: number; y: number }

type PhotoCropDialogProps = {
  imageUrl: string
  onConfirm: (photo: Blob) => Promise<void>
  onClose: () => void
}

// Mostra como a foto vai ficar: arraste para posicionar e use o controle para aproximar
export function PhotoCropDialog({ imageUrl, onConfirm, onClose }: PhotoCropDialogProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const dragStart = useRef<{ pointer: Offset; offset: Offset } | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Escala em que a imagem cobre o quadro inteiro, sem esticar
  const baseScale = size ? FRAME_SIZE / Math.min(size.width, size.height) : 1
  const displayWidth = size ? size.width * baseScale * zoom : 0
  const displayHeight = size ? size.height * baseScale * zoom : 0

  // Não deixa aparecer espaço vazio dentro do quadro
  function clamp(next: Offset, width: number, height: number): Offset {
    return {
      x: Math.min(0, Math.max(FRAME_SIZE - width, next.x)),
      y: Math.min(0, Math.max(FRAME_SIZE - height, next.y)),
    }
  }

  function handleLoad() {
    const image = imageRef.current
    if (!image) return
    const scale = FRAME_SIZE / Math.min(image.naturalWidth, image.naturalHeight)
    setSize({ width: image.naturalWidth, height: image.naturalHeight })
    // Começa com a imagem centralizada
    setOffset({
      x: (FRAME_SIZE - image.naturalWidth * scale) / 2,
      y: (FRAME_SIZE - image.naturalHeight * scale) / 2,
    })
  }

  // Aproxima mantendo no centro o que já está no centro do quadro
  function handleZoom(nextZoom: number) {
    if (!size) return
    const ratio = nextZoom / zoom
    const center = FRAME_SIZE / 2
    setOffset(
      clamp(
        { x: center - (center - offset.x) * ratio, y: center - (center - offset.y) * ratio },
        size.width * baseScale * nextZoom,
        size.height * baseScale * nextZoom,
      ),
    )
    setZoom(nextZoom)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = { pointer: { x: event.clientX, y: event.clientY }, offset }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start) return
    setOffset(
      clamp(
        {
          x: start.offset.x + event.clientX - start.pointer.x,
          y: start.offset.y + event.clientY - start.pointer.y,
        },
        displayWidth,
        displayHeight,
      ),
    )
  }

  async function handleConfirm() {
    const image = imageRef.current
    if (!image) return
    setSaving(true)
    setError(null)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Não foi possível preparar a foto.')
      // Fundo branco: JPEG não tem transparência
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      const ratio = OUTPUT_SIZE / FRAME_SIZE
      ctx.drawImage(image, offset.x * ratio, offset.y * ratio, displayWidth * ratio, displayHeight * ratio)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('Não foi possível preparar a foto.')
      await onConfirm(blob)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Ajustar foto" onClose={onClose}>
      <div className="space-y-4">
        <div
          className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-lg bg-black select-none active:cursor-grabbing"
          style={{ width: FRAME_SIZE, height: FRAME_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => (dragStart.current = null)}
          onPointerCancel={() => (dragStart.current = null)}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Prévia do recorte da foto"
            draggable={false}
            onLoad={handleLoad}
            onError={() => setError('Não foi possível ler essa imagem. Tente uma foto em JPEG ou PNG.')}
            className="absolute top-0 left-0 max-w-none"
            style={{
              width: displayWidth || undefined,
              height: displayHeight || undefined,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        </div>

        <label className="block text-sm">
          <span className="text-white/70">Aproximar</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!size}
            onChange={(event) => handleZoom(Number(event.target.value))}
            className="mt-1 w-full accent-brand"
          />
        </label>
        <p className="text-xs text-white/40">Arraste a foto para centralizar o rosto.</p>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !size}
            onClick={handleConfirm}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-40"
          >
            {saving ? 'Salvando...' : 'Usar esta foto'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
