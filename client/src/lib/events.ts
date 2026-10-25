// Um evento do calendário (ex.: "PROVA CÁLCULO" em 2026-11-20)
export type CalendarEvent = {
  id: string
  title: string
  description: string | null
  date: string // "AAAA-MM-DD"
  start: string | null // "HH:MM"; null = dia inteiro
  end: string | null // "HH:MM"
  color: string // "#rrggbb"
}

export type CalendarEventInput = Omit<CalendarEvent, 'id'>

// Eventos de dia inteiro primeiro, depois por horário
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.start === b.start) return a.title.localeCompare(b.title)
  if (a.start === null) return -1
  if (b.start === null) return 1
  return a.start.localeCompare(b.start)
}
