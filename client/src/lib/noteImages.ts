// Imagens da Lousa: carregamento com cache e preparação (redução) antes do envio.

const MAX_DIMENSION = 1600 // px: imagens maiores são reduzidas antes de enviar
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB antes da redução

const cache = new Map<string, HTMLImageElement>()

export function noteImageUrl(noteId: string, imageId: string) {
  return `/api/notes/${noteId}/images/${imageId}`
}

// Retorna a imagem (começando a carregar, se for a primeira vez). onLoad avisa quando terminar.
export function getNoteImage(noteId: string, imageId: string, onLoad?: () => void): HTMLImageElement {
  const url = noteImageUrl(noteId, imageId)
  let image = cache.get(url)
  if (!image) {
    image = new Image()
    image.src = url
    cache.set(url, image)
  }
  if (!image.complete && onLoad) image.addEventListener('load', onLoad, { once: true })
  return image
}

// Espera todas as imagens carregarem (usado antes de exportar o PDF)
export async function preloadNoteImages(noteId: string, imageIds: string[]) {
  await Promise.all(imageIds.map((id) => getNoteImage(noteId, id).decode().catch(() => undefined)))
}

// Reduz a imagem (se for grande) e converte para PNG (mantém transparência) ou JPEG (fotos, menor)
export async function prepareImage(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Esse arquivo não é uma imagem.')
  if (file.size > MAX_FILE_SIZE) throw new Error('Imagem grande demais (máximo de 20 MB).')

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Não foi possível ler essa imagem.')
  })
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const type = file.type === 'image/png' || file.type === 'image/gif' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9))
  if (!blob) throw new Error('Não foi possível preparar a imagem.')
  return { blob, width, height }
}
