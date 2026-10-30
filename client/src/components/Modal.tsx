import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'md' | 'xl' | '2xl' // xl/2xl: janelas largas, como o player de vídeo com notas
}

// Janela que abre por cima da tela. Fecha com Esc, no X ou clicando fora.
export function Modal({ title, onClose, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          'max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-white/10 bg-ink-light p-6 shadow-2xl ' +
          { md: 'max-w-md', xl: 'max-w-4xl', '2xl': 'max-w-7xl' }[size]
        }
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
