import { CalendarDays, House, Presentation, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

type NavItem = {
  label: string
  to: string
  icon: LucideIcon
  // true = só fica ativo no endereço exato (necessário para "/", que é o começo de todos os endereços)
  end?: boolean
}

type NavGroup = {
  title: string
  items: NavItem[]
}

// Para criar novas abas, basta adicionar itens/grupos aqui
const groups: NavGroup[] = [
  {
    title: 'Início',
    items: [{ label: 'Home', to: '/', icon: House, end: true }],
  },
  {
    title: 'Rotina',
    items: [
      { label: 'Calendário', to: '/calendario', icon: CalendarDays },
      { label: 'Lousa', to: '/lousa', icon: Presentation },
    ],
  },
]

type SidebarProps = {
  open: boolean
}

export function Sidebar({ open }: SidebarProps) {
  return (
    <aside
      className={
        'shrink-0 overflow-hidden bg-ink-light transition-[width] duration-200 ' +
        (open ? 'w-60 border-r border-white/10' : 'w-0')
      }
    >
      <nav className="w-60 space-y-6 p-4">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-white/40">
              {group.title}
            </h2>
            <ul className="space-y-1">
              {group.items.map(({ label, to, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      'flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-brand transition hover:bg-brand/10 ' +
                      (isActive ? 'bg-brand/15' : '')
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
