import { Menu } from 'lucide-react'
import { Link } from 'react-router'
import { Logo } from './Logo'

type HeaderProps = {
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-ink/90 px-4 backdrop-blur">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Abrir ou fechar menu"
        className="rounded-lg p-2 text-white/70 transition hover:bg-white/5 hover:text-white"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link to="/" aria-label="Ir para o início" className="rounded-lg px-1 transition hover:opacity-80">
        <Logo className="text-3xl" />
      </Link>
    </header>
  )
}
