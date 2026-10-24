import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './layouts/AppLayout'
import { CalendarPage } from './pages/calendar/CalendarPage'
import { ClassesView } from './pages/calendar/ClassesView'
import { MonthView } from './pages/calendar/MonthView'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          {/* Por enquanto a tela inicial é o calendário */}
          <Route index element={<Navigate to="/calendario" replace />} />
          <Route path="calendario" element={<CalendarPage />}>
            <Route index element={<MonthView />} />
            <Route path="aulas" element={<ClassesView />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
