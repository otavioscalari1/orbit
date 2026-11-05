import { ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { api } from '../../lib/api'
import { PhotoCropDialog } from './PhotoCropDialog'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB antes do recorte

type PhotoFieldProps = {
  photoUrl: string | null // null = sem foto
  onChange: (hasPhoto: boolean) => void
}

// Foto opcional do currículo: escolher, recortar, trocar e remover
export function PhotoField({ photoUrl, onChange }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cropUrl, setCropUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Libera da memória a cópia temporária da imagem escolhida
  useEffect(() => {
    return () => {
      if (cropUrl) URL.revokeObjectURL(cropUrl)
    }
  }, [cropUrl])

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/')) return setError('Esse arquivo não é uma imagem.')
    if (file.size > MAX_FILE_SIZE) return setError('Imagem grande demais (máximo de 20 MB).')
    setCropUrl(URL.createObjectURL(file))
  }

  async function handleRemove() {
    setError(null)
    try {
      await api.deleteResumePhoto()
      onChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Sem foto não aparece nada aqui: nem quadrado vazio, nem ícone no lugar */}
      {photoUrl && (
        <img src={photoUrl} alt="Sua foto" className="h-24 w-24 shrink-0 rounded-lg border border-white/15 object-cover" />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/70">Foto (opcional)</p>
        <p className="mt-1 text-xs text-white/40">
          Use uma foto profissional e confira se a vaga aceita currículo com foto.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium transition hover:border-brand hover:text-brand"
          >
            <ImagePlus className="h-4 w-4" />
            {photoUrl ? 'Trocar foto' : 'Escolher foto'}
          </button>
          {photoUrl && (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-rose-400 transition hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {cropUrl && (
        <PhotoCropDialog
          imageUrl={cropUrl}
          onClose={() => setCropUrl(null)}
          onConfirm={async (photo) => {
            await api.uploadResumePhoto(photo)
            onChange(true)
            setCropUrl(null)
          }}
        />
      )}
    </div>
  )
}
