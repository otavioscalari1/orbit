import { Clapperboard, FolderInput, Play, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { api } from '../../lib/api'
import { videoThumbnailUrl, type Video, type VideoFolder } from '../../lib/videos'
import { FolderList, type FolderView } from './FolderList'
import { FolderFormDialog, MoveVideoDialog } from './VideoDialogs'
import { VideoPlayerDialog } from './VideoPlayerDialog'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }

// Janela aberta no momento (no máximo uma por vez)
type Dialog =
  | { kind: 'play'; video: Video }
  | { kind: 'move'; video: Video }
  | { kind: 'delete-video'; video: Video }
  | { kind: 'create-folder' }
  | { kind: 'rename-folder'; folder: VideoFolder }
  | { kind: 'delete-folder'; folder: VideoFolder }
  | null

// Busca ignorando maiúsculas e acentos
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Biblioteca de vídeos do YouTube, organizada em pastas
export function VideosPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [videos, setVideos] = useState<Video[]>([])
  const [folders, setFolders] = useState<VideoFolder[]>([])
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)

  // A pasta aberta fica no endereço (?pasta=...), para continuar nela ao recarregar a página
  const requested = searchParams.get('pasta') ?? 'all'
  const current: FolderView =
    requested === 'all' || requested === 'none' || folders.some((folder) => folder.id === requested) ? requested : 'all'
  const currentFolder = folders.find((folder) => folder.id === current)

  function openView(view: FolderView) {
    setFilter('')
    setSearchParams(view === 'all' ? {} : { pasta: view })
  }

  function loadData() {
    setLoad({ status: 'loading' })
    Promise.all([api.getVideos(), api.getVideoFolders()])
      .then(([loadedVideos, loadedFolders]) => {
        setVideos(loadedVideos)
        setFolders(loadedFolders)
        setLoad({ status: 'ready' })
      })
      .catch((error: Error) => setLoad({ status: 'error', message: error.message }))
  }

  useEffect(loadData, [])

  // Quantos vídeos há em cada lugar (calculado a partir da lista, então está sempre atualizado)
  const counts = useMemo(() => {
    const byFolder = new Map<string, number>()
    let none = 0
    for (const video of videos) {
      if (video.folderId) byFolder.set(video.folderId, (byFolder.get(video.folderId) ?? 0) + 1)
      else none++
    }
    return { all: videos.length, none, byFolder }
  }, [videos])

  const inView = videos.filter((video) =>
    current === 'all' ? true : current === 'none' ? video.folderId === null : video.folderId === current,
  )
  const visible = filter.trim()
    ? inView.filter((video) => normalize(`${video.title} ${video.channelName ?? ''}`).includes(normalize(filter.trim())))
    : inView

  // Ao adicionar com uma pasta aberta, o vídeo entra nela
  const targetFolderId = currentFolder?.id ?? null

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!url.trim()) return setAddError('Cole o link de um vídeo do YouTube.')
    setAdding(true)
    setAddError(null)
    try {
      const video = await api.addVideo(url.trim(), targetFolderId)
      setVideos((list) => [video, ...list])
      setUrl('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setAdding(false)
    }
  }

  const viewTitle = current === 'all' ? 'Todos os vídeos' : current === 'none' ? 'Sem pasta' : (currentFolder?.name ?? '')

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Vídeos</h1>
        <p className="mt-1 text-sm text-white/60">Sua biblioteca de vídeos do YouTube para estudar, organizada em pastas.</p>
      </div>

      {load.status === 'loading' && <p className="py-12 text-center text-white/50">Carregando vídeos...</p>}

      {load.status === 'error' && (
        <div className="py-12 text-center">
          <p className="text-rose-400">{load.message}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition hover:border-brand hover:text-brand"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {load.status === 'ready' && (
        <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-0 lg:self-start">
            <FolderList
              folders={folders}
              counts={counts}
              current={current}
              onOpen={openView}
              onCreate={() => setDialog({ kind: 'create-folder' })}
              onRename={(folder) => setDialog({ kind: 'rename-folder', folder })}
              onDelete={(folder) => setDialog({ kind: 'delete-folder', folder })}
            />
          </aside>

          <section className="min-w-0">
            <h2 className="mb-3 truncate text-xl font-semibold">{viewTitle}</h2>

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
              {addError ??
                (currentFolder
                  ? `O vídeo vai entrar na pasta "${currentFolder.name}".`
                  : 'Aceita links do youtube.com, youtu.be e Shorts.')}
            </p>

            {inView.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 py-16 text-center">
                <Clapperboard className="mx-auto h-10 w-10 text-white/30" />
                <p className="mt-3 text-white/70">
                  {currentFolder ? 'Esta pasta está vazia.' : current === 'none' ? 'Nenhum vídeo sem pasta.' : 'Nenhum vídeo ainda.'}
                </p>
                <p className="text-sm text-white/40">
                  {currentFolder
                    ? 'Cole um link acima ou mova vídeos para cá pelo botão de pasta de cada vídeo.'
                    : 'Cole o link de um vídeo do YouTube acima para começar.'}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-wider text-white/50">
                    <span className="text-brand">•</span> {inView.length} {inView.length === 1 ? 'vídeo' : 'vídeos'}
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
                  <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {visible.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        // Em "Todos os vídeos", mostra em qual pasta o vídeo está
                        folderName={current === 'all' ? folders.find((f) => f.id === video.folderId)?.name : undefined}
                        onPlay={() => setDialog({ kind: 'play', video })}
                        onMove={() => setDialog({ kind: 'move', video })}
                        onDelete={() => setDialog({ kind: 'delete-video', video })}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* ---- Janelas ---- */}

      {dialog?.kind === 'play' && <VideoPlayerDialog video={dialog.video} onClose={() => setDialog(null)} />}

      {dialog?.kind === 'move' && (
        <MoveVideoDialog
          video={dialog.video}
          folders={folders}
          onClose={() => setDialog(null)}
          onMove={async (folderId) => {
            const updated = await api.moveVideo(dialog.video.id, folderId)
            setVideos((list) => list.map((video) => (video.id === updated.id ? updated : video)))
            setDialog(null)
          }}
        />
      )}

      {dialog?.kind === 'delete-video' && (
        <ConfirmDialog
          title="Remover vídeo"
          confirmLabel="Remover"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await api.deleteVideo(dialog.video.id)
            setVideos((list) => list.filter((video) => video.id !== dialog.video.id))
            setDialog(null)
          }}
        >
          Remover <span className="font-semibold text-white">{dialog.video.title}</span> da sua biblioteca? O vídeo
          continua no YouTube.
        </ConfirmDialog>
      )}

      {dialog?.kind === 'create-folder' && (
        <FolderFormDialog
          onClose={() => setDialog(null)}
          onSave={async (name) => {
            const folder = await api.createVideoFolder(name)
            setFolders((list) => [...list, folder].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
            setDialog(null)
            openView(folder.id)
          }}
        />
      )}

      {dialog?.kind === 'rename-folder' && (
        <FolderFormDialog
          folder={dialog.folder}
          onClose={() => setDialog(null)}
          onSave={async (name) => {
            const updated = await api.renameVideoFolder(dialog.folder.id, name)
            setFolders((list) =>
              list.map((folder) => (folder.id === updated.id ? updated : folder)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
            )
            setDialog(null)
          }}
        />
      )}

      {dialog?.kind === 'delete-folder' && (
        <ConfirmDialog
          title="Excluir pasta"
          confirmLabel="Excluir pasta"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const removedId = dialog.folder.id
            await api.deleteVideoFolder(removedId)
            setFolders((list) => list.filter((folder) => folder.id !== removedId))
            // Os vídeos da pasta continuam na biblioteca, agora "Sem pasta"
            setVideos((list) => list.map((video) => (video.folderId === removedId ? { ...video, folderId: null } : video)))
            if (current === removedId) openView('all')
            setDialog(null)
          }}
        >
          Excluir a pasta <span className="font-semibold text-white">{dialog.folder.name}</span>?{' '}
          {(counts.byFolder.get(dialog.folder.id) ?? 0) > 0
            ? 'Os vídeos dela não serão apagados: eles vão para "Sem pasta".'
            : 'Ela está vazia.'}
        </ConfirmDialog>
      )}
    </div>
  )
}

type VideoCardProps = {
  video: Video
  folderName?: string
  onPlay: () => void
  onMove: () => void
  onDelete: () => void
}

function VideoCard({ video, folderName, onPlay, onMove, onDelete }: VideoCardProps) {
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onPlay}
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
          <p className="mt-1 truncate text-sm text-white/50">
            {video.channelName}
            {folderName && <span className="text-brand/80"> · {folderName}</span>}
          </p>
        </div>
      </button>

      <div className="absolute top-3 right-3 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          aria-label={`Mover ${video.title} para uma pasta`}
          title="Mover para pasta"
          onClick={onMove}
          className="rounded-lg bg-ink/80 p-2 text-white/70 hover:text-brand"
        >
          <FolderInput className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`Remover ${video.title}`}
          title="Remover da biblioteca"
          onClick={onDelete}
          className="rounded-lg bg-ink/80 p-2 text-white/70 hover:text-rose-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}
