import { Clapperboard, ExternalLink, Play, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { videoEmbedUrl, videoThumbnailUrl, videoWatchUrl, type Video } from '../../lib/videos'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }

// Biblioteca de vídeos do YouTube: o usuário cola o link e o vídeo entra na lista
export function VideosPage() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [videos, setVideos] = useState<Video[]>([])
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [playing, setPlaying] = useState<Video | null>(null)
  const [deleting, setDeleting] = useState<Video | null>(null)

  function loadVideos() {
    setLoad({ status: 'loading' })
    api
      .getVideos()
      .then((data) => {
        setVideos(data)
        setLoad({ status: 'ready' })
      })
      .catch((error: Error) => setLoad({ status: 'error', message: error.message }))
  }

  useEffect(loadVideos, [])

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!url.trim()) return setAddError('Cole o link de um vídeo do YouTube.')
    setAdding(true)
    setAddError(null)
    try {
      const video = await api.addVideo(url.trim())
      setVideos((current) => [video, ...current])
      setUrl('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setAdding(false)
    }
  }

  // Busca pelo título ou pelo canal, ignorando maiúsculas e acentos
  const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const visible = filter.trim()
    ? videos.filter((video) => normalize(`${video.title} ${video.channelName ?? ''}`).includes(normalize(filter.trim())))
    : videos

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Vídeos</h1>
        <p className="mt-1 text-sm text-white/60">Sua biblioteca de vídeos do YouTube para estudar.</p>
      </div>

      {/* Adicionar vídeo colando o link */}
      <form onSubmit={handleAdd} className="mb-2 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(event) => {
            setUrl(event.target.value)
            setAddError(null)
          }}
          placeholder="Cole o link do vídeo (ex.: https://www.youtube.com/watch?v=...)"
          aria-label="Link do vídeo do YouTube"
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-ink-light px-4 py-2.5 outline-none placeholder:text-white/30 focus:border-brand"
        />
        <button
          type="submit"
          disabled={adding}
          className="flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          {adding ? 'Adicionando...' : 'Adicionar'}
        </button>
      </form>
      <p className={'mb-6 min-h-5 text-sm ' + (addError ? 'text-rose-400' : 'text-white/40')}>
        {addError ?? 'Aceita links do youtube.com, youtu.be e Shorts.'}
      </p>

      {load.status === 'loading' && <p className="py-12 text-center text-white/50">Carregando vídeos...</p>}

      {load.status === 'error' && (
        <div className="py-12 text-center">
          <p className="text-rose-400">{load.message}</p>
          <button
            type="button"
            onClick={loadVideos}
            className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition hover:border-brand hover:text-brand"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {load.status === 'ready' && videos.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 py-16 text-center">
          <Clapperboard className="mx-auto h-10 w-10 text-white/30" />
          <p className="mt-3 text-white/70">Nenhum vídeo ainda.</p>
          <p className="text-sm text-white/40">Cole o link de um vídeo do YouTube acima para começar.</p>
        </div>
      )}

      {load.status === 'ready' && videos.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-wider text-white/50">
              <span className="text-brand">•</span> {videos.length} {videos.length === 1 ? 'vídeo' : 'vídeos'}
            </p>
            <label className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Buscar por título ou canal"
                aria-label="Buscar vídeos"
                className="w-full rounded-lg border border-white/10 bg-transparent py-2 pr-3 pl-9 text-sm outline-none placeholder:text-white/30 focus:border-brand"
              />
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/50">Nenhum vídeo encontrado para "{filter}".</p>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((video) => (
                <li key={video.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setPlaying(video)}
                    className="block w-full overflow-hidden rounded-xl border border-white/10 bg-ink-light text-left transition hover:border-brand/50"
                  >
                    <div className="relative aspect-video bg-black">
                      <img
                        src={videoThumbnailUrl(video.youtubeId)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:opacity-80"
                      />
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                        <span className="rounded-full bg-brand p-3 text-ink shadow-lg">
                          <Play className="h-6 w-6 fill-current" />
                        </span>
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="line-clamp-2 font-semibold leading-snug">{video.title}</p>
                      {video.channelName && <p className="mt-1 truncate text-sm text-white/50">{video.channelName}</p>}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${video.title}`}
                    onClick={() => setDeleting(video)}
                    className="absolute top-3 right-3 rounded-lg bg-ink/80 p-2 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-rose-400 focus:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Player */}
      {playing && (
        <Modal title={playing.title} size="xl" onClose={() => setPlaying(null)}>
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={videoEmbedUrl(playing.youtubeId)}
              title={playing.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-white/60">{playing.channelName}</span>
            <a
              href={videoWatchUrl(playing.youtubeId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-white"
            >
              Abrir no YouTube
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </Modal>
      )}

      {/* Confirmar remoção */}
      {deleting && (
        <Modal title="Remover vídeo" onClose={() => setDeleting(null)}>
          <ConfirmDelete
            video={deleting}
            onCancel={() => setDeleting(null)}
            onConfirm={async () => {
              await api.deleteVideo(deleting.id)
              setVideos((current) => current.filter((video) => video.id !== deleting.id))
              setDeleting(null)
            }}
          />
        </Modal>
      )}
    </div>
  )
}

function ConfirmDelete({
  video,
  onConfirm,
  onCancel,
}: {
  video: Video
  onConfirm: () => Promise<void>
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-white/70">
        Remover <span className="font-semibold text-white">{video.title}</span> da sua biblioteca? O vídeo continua no
        YouTube.
      </p>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleConfirm}
          className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-40"
        >
          {saving ? 'Removendo...' : 'Remover'}
        </button>
      </div>
    </div>
  )
}
