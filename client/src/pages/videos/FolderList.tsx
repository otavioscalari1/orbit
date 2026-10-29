import { Folder, FolderOpen, FolderPlus, Inbox, Library, Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { VideoFolder } from '../../lib/videos'

// Qual "lugar" da biblioteca está aberto: todos, só os sem pasta, ou uma pasta específica (id)
export type FolderView = 'all' | 'none' | string

type FolderListProps = {
  folders: VideoFolder[]
  counts: { all: number; none: number; byFolder: Map<string, number> }
  current: FolderView
  onOpen: (view: FolderView) => void
  onCreate: () => void
  onRename: (folder: VideoFolder) => void
  onDelete: (folder: VideoFolder) => void
}

// Coluna com as pastas da biblioteca de vídeos
export function FolderList({ folders, counts, current, onOpen, onCreate, onRename, onDelete }: FolderListProps) {
  return (
    <nav aria-label="Pastas de vídeos">
      <div className="mb-2 flex items-center justify-between px-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-white/50">
          <span className="text-brand">•</span> Pastas
        </h2>
        <button
          type="button"
          onClick={onCreate}
          title="Nova pasta"
          aria-label="Nova pasta"
          className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/5 hover:text-brand"
        >
          <FolderPlus className="h-5 w-5" />
        </button>
      </div>

      <ul className="space-y-0.5">
        <FolderItem icon={Library} label="Todos os vídeos" count={counts.all} active={current === 'all'} onClick={() => onOpen('all')} />
        <FolderItem icon={Inbox} label="Sem pasta" count={counts.none} active={current === 'none'} onClick={() => onOpen('none')} />
      </ul>

      <div className="my-3 border-t border-white/10" />

      {folders.length === 0 ? (
        <button
          type="button"
          onClick={onCreate}
          className="w-full rounded-lg border border-dashed border-white/15 px-3 py-4 text-sm text-white/50 transition hover:border-brand/50 hover:text-brand"
        >
          Criar a primeira pasta
        </button>
      ) : (
        <ul className="space-y-0.5">
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              icon={current === folder.id ? FolderOpen : Folder}
              label={folder.name}
              count={counts.byFolder.get(folder.id) ?? 0}
              active={current === folder.id}
              onClick={() => onOpen(folder.id)}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => onRename(folder)}
                    title="Renomear"
                    aria-label={`Renomear ${folder.name}`}
                    className="rounded p-1 text-white/50 hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(folder)}
                    title="Excluir pasta"
                    aria-label={`Excluir ${folder.name}`}
                    className="rounded p-1 text-white/50 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              }
            />
          ))}
        </ul>
      )}
    </nav>
  )
}

type FolderItemProps = {
  icon: typeof Folder
  label: string
  count: number
  active: boolean
  onClick: () => void
  actions?: ReactNode
}

function FolderItem({ icon: Icon, label, count, active, onClick, actions }: FolderItemProps) {
  return (
    <li
      className={
        'group flex items-center rounded-lg transition ' + (active ? 'bg-brand/15 text-brand' : 'text-white/80 hover:bg-white/5')
      }
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm font-medium">{label}</span>
        <span className={'ml-auto text-xs ' + (active ? 'text-brand/80' : 'text-white/40')}>{count}</span>
      </button>
      {actions && (
        <span className="flex shrink-0 gap-0.5 pr-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          {actions}
        </span>
      )}
    </li>
  )
}
