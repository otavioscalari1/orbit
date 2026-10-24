import { useState } from 'react'
import { Outlet } from 'react-router'
import { Header } from '../components/Header'
import { Sidebar } from '../components/Sidebar'

// Estrutura comum a todas as telas: header em cima, sidebar à esquerda e a página no meio
export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen flex-col">
      <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar open={sidebarOpen} />
        <main className="min-w-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
