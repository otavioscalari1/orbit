import type { ClassItem, TimeWindow } from './schedule'

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
}
