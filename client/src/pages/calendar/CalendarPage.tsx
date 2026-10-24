import { NavLink, Outlet } from 'react-router'

const tabs = [
  { label: 'Calendário', to: '/calendario', end: true },
  { label: 'Aulas', to: '/calendario/aulas', end: false },
]

// Página "Calendário" com suas sub-abas. O conteúdo de cada aba aparece no <Outlet />.
export function CalendarPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex gap-1 border-b border-white/10">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              '-mb-px border-b-2 px-4 py-2 font-medium transition ' +
              (isActive ? 'border-brand text-brand' : 'border-transparent text-white/60 hover:text-white')
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
