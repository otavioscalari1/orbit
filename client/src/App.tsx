import { BrowserRouter, Route, Routes } from 'react-router'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { CalendarPage } from './pages/calendar/CalendarPage'
import { ClassesView } from './pages/calendar/ClassesView'
import { MonthView } from './pages/calendar/MonthView'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
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
