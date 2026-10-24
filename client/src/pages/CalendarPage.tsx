import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getBrazilianHolidays, toDateKey, type Holiday } from '../lib/holidays'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Monta as 6 semanas (42 dias) exibidas no mês, incluindo dias do mês anterior/seguinte
function getCalendarDays(year: number, month: number): Date[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - firstWeekday + i))
}

export function CalendarPage() {
  const today = new Date()
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const days = useMemo(() => getCalendarDays(current.year, current.month), [current])

  // Feriados do ano exibido e dos vizinhos (a grade pode mostrar dias de dezembro/janeiro)
  const holidaysByDay = useMemo(() => {
    const map = new Map<string, Holiday[]>()
    for (const year of [current.year - 1, current.year, current.year + 1]) {
      for (const holiday of getBrazilianHolidays(year)) {
        const key = toDateKey(holiday.date)
        map.set(key, [...(map.get(key) ?? []), holiday])
      }
    }
    return map
  }, [current.year])

  const monthLabel = new Date(current.year, current.month, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  function changeMonth(offset: number) {
    setCurrent(({ year, month }) => {
      const date = new Date(year, month + offset, 1)
      return { year: date.getFullYear(), month: date.getMonth() }
    })
  }

  function goToToday() {
    setCurrent({ year: today.getFullYear(), month: today.getMonth() })
  }

  const todayKey = toDateKey(today)

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold capitalize">{monthLabel}</h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToToday}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition hover:border-brand hover:text-brand"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Mês anterior"
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Próximo mês"
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-white/10 pb-2 text-center text-xs font-semibold uppercase tracking-wider text-white/40">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday}>{weekday}</div>
        ))}
      </div>

      <div className="grid min-h-[36rem] flex-1 grid-cols-7 grid-rows-6 gap-px overflow-hidden rounded-b-xl bg-white/10">
        {days.map((day) => {
          const key = toDateKey(day)
          const inMonth = day.getMonth() === current.month
          const isToday = key === todayKey
          const holidays = holidaysByDay.get(key) ?? []
          const isHoliday = holidays.some((holiday) => !holiday.optional)

          return (
            <div
              key={key}
              className={
                'flex min-h-0 flex-col gap-1 p-2 ' +
                (isHoliday ? 'bg-brand/10 ' : 'bg-ink ') +
                (inMonth ? '' : 'opacity-40')
              }
            >
              <span
                className={
                  'flex h-7 w-7 items-center justify-center rounded-full text-sm ' +
                  (isToday
                    ? 'bg-brand font-semibold text-ink'
                    : isHoliday
                      ? 'font-semibold text-brand'
                      : 'text-white/80')
                }
              >
                {day.getDate()}
              </span>

              {holidays.map((holiday) => (
                <span
                  key={holiday.name}
                  title={`${holiday.name} (${holiday.optional ? 'ponto facultativo' : 'feriado nacional'})`}
                  className={
                    'truncate rounded px-1.5 py-0.5 text-xs ' +
                    (holiday.optional
                      ? 'border border-dashed border-brand/40 text-brand/80'
                      : 'bg-brand font-medium text-ink')
                  }
                >
                  {holiday.name}
                </span>
              ))}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/60">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-brand" /> Feriado nacional
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-dashed border-brand/60" /> Ponto facultativo
        </span>
      </div>
    </div>
  )
}
