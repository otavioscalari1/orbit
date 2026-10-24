// Janela de horário do dia, em horas cheias (ex.: 8 às 23). Vale para os 7 dias da semana.
export type TimeWindow = {
  startHour: number
  endHour: number
}

// Uma atividade fixa da semana (ex.: Cálculo 1, segunda e quarta, 19:00 às 21:00)
export type ClassItem = {
  id: string
  name: string
  days: number[] // 0 = domingo ... 6 = sábado (mesmo padrão do Date.getDay())
  start: string // "HH:MM"
  end: string // "HH:MM"
  color: string // "#rrggbb"
}

// Ordem de exibição: a semana começa na segunda
export const WEEK_DAYS = [
  { day: 1, short: 'Seg', label: 'Segunda' },
  { day: 2, short: 'Ter', label: 'Terça' },
  { day: 3, short: 'Qua', label: 'Quarta' },
  { day: 4, short: 'Qui', label: 'Quinta' },
  { day: 5, short: 'Sex', label: 'Sexta' },
  { day: 6, short: 'Sáb', label: 'Sábado' },
  { day: 0, short: 'Dom', label: 'Domingo' },
]

export const CLASS_COLORS = [
  '#5ad1ec',
  '#818cf8',
  '#c084fc',
  '#f472b6',
  '#fb7185',
  '#fb923c',
  '#facc15',
  '#4ade80',
]

// "19:30" -> 1170 (minutos desde a meia-noite)
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// 8 -> "08:00"
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}
