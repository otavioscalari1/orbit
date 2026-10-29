import type { NoteDetail, NotePage, NoteSummary, PageContent, PaperTheme } from './board'
import type { CalendarEvent, CalendarEventInput } from './events'
import type { ClassItem, TimeWindow } from './schedule'
import type { Video } from './videos'

// Faz uma requisição para o backend. Se der erro, lança a mensagem que o servidor mandou.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Não foi possível falar com o servidor.')
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

type ClassInput = Omit<ClassItem, 'id'>

export const api = {
  getTimeWindow: () => request<TimeWindow | null>('/time-window'),
  saveTimeWindow: (value: TimeWindow) =>
    request<TimeWindow>('/time-window', { method: 'PUT', body: JSON.stringify(value) }),

  getClasses: () => request<ClassItem[]>('/classes'),
  createClass: (value: ClassInput) =>
    request<ClassItem>('/classes', { method: 'POST', body: JSON.stringify(value) }),
  updateClass: (id: string, value: ClassInput) =>
    request<ClassItem>(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(value) }),
  deleteClass: (id: string) => request<void>(`/classes/${id}`, { method: 'DELETE' }),

  // from/to no formato "AAAA-MM-DD"
  getEvents: (from: string, to: string) =>
    request<CalendarEvent[]>(`/events?${new URLSearchParams({ from, to })}`),
  createEvent: (value: CalendarEventInput) =>
    request<CalendarEvent>('/events', { method: 'POST', body: JSON.stringify(value) }),
  updateEvent: (id: string, value: CalendarEventInput) =>
    request<CalendarEvent>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(value) }),
  deleteEvent: (id: string) => request<void>(`/events/${id}`, { method: 'DELETE' }),

  // Lousa
  getNotes: () => request<NoteSummary[]>('/notes'),
  createNote: (title: string) =>
    request<NoteSummary>('/notes', { method: 'POST', body: JSON.stringify({ title }) }),
  getNote: (id: string) => request<NoteDetail>(`/notes/${id}`),
  updateNote: (id: string, value: { title?: string; paperTheme?: PaperTheme }) =>
    request<{ id: string; title: string; paperTheme: PaperTheme }>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(value),
    }),
  deleteNote: (id: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }),
  addNotePage: (noteId: string, afterPosition?: number) =>
    request<NotePage>(`/notes/${noteId}/pages`, { method: 'POST', body: JSON.stringify({ afterPosition }) }),
  saveNotePage: (noteId: string, pageId: string, content: PageContent) =>
    request<void>(`/notes/${noteId}/pages/${pageId}`, { method: 'PUT', body: JSON.stringify(content) }),
  // Envia o arquivo da imagem (não JSON) e recebe o id dela
  uploadNoteImage: (noteId: string, image: Blob) =>
    request<{ id: string }>(`/notes/${noteId}/images`, {
      method: 'POST',
      headers: { 'Content-Type': image.type },
      body: image,
    }),
  deleteNotePage: (noteId: string, pageId: string) =>
    request<void>(`/notes/${noteId}/pages/${pageId}`, { method: 'DELETE' }),

  // Vídeos
  getVideos: () => request<Video[]>('/videos'),
  addVideo: (url: string) => request<Video>('/videos', { method: 'POST', body: JSON.stringify({ url }) }),
  deleteVideo: (id: string) => request<void>(`/videos/${id}`, { method: 'DELETE' }),
}
