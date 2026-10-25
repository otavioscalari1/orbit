import { compareEvents, type CalendarEvent } from './events'
import { getBrazilianHolidays, toDateKey, type Holiday } from './holidays'
import { toMinutes, type ClassItem } from './schedule'

const MINUTES_PER_DAY = 24 * 60

export type NextClass = {
  item: ClassItem
  daysAhead: number // 0 = hoje, 1 = amanhã...
  ongoing: boolean // true = está acontecendo agora
}

// Próxima ocorrência de alguma aula a partir de "now" (inclui a aula que está acontecendo agora)
export function findNextClass(classes: ClassItem[], now: Date): NextClass | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const today = now.getDay()
  let best: (NextClass & { startsIn: number }) | null = null

  for (const item of classes) {
    const start = toMinutes(item.start)
    const end = toMinutes(item.end)

    for (const weekday of item.days) {
      let daysAhead = (weekday - today + 7) % 7
      const ongoing = daysAhead === 0 && start <= nowMinutes && nowMinutes < end
      // Se a aula de hoje já terminou, a próxima é na semana que vem
      if (daysAhead === 0 && end <= nowMinutes) daysAhead = 7

      const startsIn = ongoing ? -1 : daysAhead * MINUTES_PER_DAY + start - nowMinutes
      if (!best || startsIn < best.startsIn) best = { item, daysAhead, ongoing, startsIn }
    }
  }

  return best && { item: best.item, daysAhead: best.daysAhead, ongoing: best.ongoing }
}

// Próximo evento que ainda não passou (hoje conta se for de dia inteiro ou se ainda não terminou)
export function findNextEvent(events: CalendarEvent[], now: Date): CalendarEvent | null {
  const todayKey = toDateKey(now)
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const upcoming = events.filter((event) => {
    if (event.date > todayKey) return true
    if (event.date < todayKey) return false
    if (event.start === null) return true
    return (event.end ?? event.start) >= nowTime
  })

  upcoming.sort((a, b) => a.date.localeCompare(b.date) || compareEvents(a, b))
  return upcoming[0] ?? null
}

// Próximo feriado nacional oficial (sem pontos facultativos), a partir de hoje
export function findNextHoliday(now: Date): Holiday | null {
  const todayKey = toDateKey(now)
  const holidays = [...getBrazilianHolidays(now.getFullYear()), ...getBrazilianHolidays(now.getFullYear() + 1)]
  return holidays.find((holiday) => !holiday.optional && toDateKey(holiday.date) >= todayKey) ?? null
}

// Diferença em dias de calendário entre hoje e uma data "AAAA-MM-DD"
export function daysUntil(dateKey: string, now: Date): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  const target = Date.UTC(year, month - 1, day)
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86_400_000)
}

// 0 -> "Hoje", 1 -> "Amanhã", 2+ -> "Em 5 dias"
export function relativeDayLabel(days: number): string {
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Amanhã'
  return `Em ${days} dias`
}
