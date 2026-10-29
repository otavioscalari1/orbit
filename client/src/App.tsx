import { BrowserRouter, Route, Routes } from 'react-router'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { BoardListPage } from './pages/board/BoardListPage'
import { NoteEditorPage } from './pages/board/NoteEditorPage'
import { VideosPage } from './pages/videos/VideosPage'
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
          <Route path="lousa" element={<BoardListPage />} />
          <Route path="lousa/:noteId" element={<NoteEditorPage />} />
          <Route path="videos" element={<VideosPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
