import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { compareEvents, type CalendarEvent, type CalendarEventInput } from '../../lib/events'
import { getBrazilianHolidays, toDateKey, type Holiday } from '../../lib/holidays'
import { EventForm } from './EventForm'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Células da grade do mês: os dias do mês, com espaços vazios (null) antes do dia 1
// para ele cair no dia da semana certo, e depois do último dia para completar a semana.
function getMonthCells(year: number, month: number): (Date | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = Array(firstWeekday).fill(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// "2026-11-20" -> "sexta-feira, 20 de novembro"
function formatLongDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

type ModalState =
  | { mode: 'create'; date: string }
  | { mode: 'edit'; event: CalendarEvent }
  | { mode: 'day'; date: string }
  | null

export function MonthView() {
  const today = new Date()
  const todayKey = toDateKey(today)
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)

  const cells = useMemo(() => getMonthCells(current.year, current.month), [current])
  const weeks = cells.length / 7
  // Quantos itens (feriados + eventos) cabem em cada dia antes de mostrar "+N mais"
  const maxItems = weeks > 5 ? 2 : 3

  const holidaysByDay = useMemo(() => {
    const map = new Map<string, Holiday[]>()
    for (const holiday of getBrazilianHolidays(current.year)) {
      const key = toDateKey(holiday.date)
      map.set(key, [...(map.get(key) ?? []), holiday])
    }
    return map
  }, [current.year])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of [...events].sort(compareEvents)) {
      map.set(event.date, [...(map.get(event.date) ?? []), event])
    }
    return map
  }, [events])

  // Busca no banco os eventos do mês exibido
  const loadEvents = useCallback(() => {
    const from = toDateKey(new Date(current.year, current.month, 1))
    const to = toDateKey(new Date(current.year, current.month + 1, 0))
    setLoadError(null)
    api
      .getEvents(from, to)
      .then(setEvents)
      .catch((error: Error) => setLoadError(error.message))
  }, [current])

  useEffect(loadEvents, [loadEvents])

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

  // Data sugerida no botão "Novo evento": hoje, se estiver no mês exibido; senão, o dia 1
  const isCurrentMonth = current.year === today.getFullYear() && current.month === today.getMonth()
  const defaultNewDate = isCurrentMonth ? todayKey : toDateKey(new Date(current.year, current.month, 1))

  async function saveEvent(value: CalendarEventInput) {
    const saved =
      modal?.mode === 'edit' ? await api.updateEvent(modal.event.id, value) : await api.createEvent(value)
    setEvents((current) => [...current.filter((event) => event.id !== saved.id), saved])
    setModal(null)
  }

  async function deleteEvent(id: string) {
    await api.deleteEvent(id)
    setEvents((current) => current.filter((event) => event.id !== id))
    setModal(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold capitalize">{monthLabel}</h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModal({ mode: 'create', date: defaultNewDate })}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark"
          >
            <Plus className="h-4 w-4" />
            Novo evento
          </button>
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

      {loadError && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          <span>Não foi possível carregar os eventos: {loadError}</span>
          <button type="button" onClick={loadEvents} className="font-medium underline hover:text-white">
            Tentar de novo
          </button>
        </div>
      )}

      <div className="grid grid-cols-7 border-b border-white/10 pb-2 text-center text-xs font-semibold uppercase tracking-wider text-white/40">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday}>{weekday}</div>
        ))}
      </div>

      <div
        className="grid min-h-[28rem] flex-1 grid-cols-7 gap-px overflow-hidden rounded-b-xl bg-white/10"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="bg-ink/60" />

          const key = toDateKey(day)
          const isToday = key === todayKey
          const holidays = holidaysByDay.get(key) ?? []
          const dayEvents = eventsByDay.get(key) ?? []
          const isHoliday = holidays.some((holiday) => !holiday.optional)

          // Feriados primeiro, depois eventos; o que não couber vira "+N mais"
          const visibleHolidays = holidays.slice(0, maxItems)
          const visibleEvents = dayEvents.slice(0, Math.max(0, maxItems - visibleHolidays.length))
          const hidden = holidays.length + dayEvents.length - visibleHolidays.length - visibleEvents.length

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              aria-label={`Criar evento em ${formatLongDate(key)}`}
              onClick={() => setModal({ mode: 'create', date: key })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setModal({ mode: 'create', date: key })
                }
              }}
              className={
                'group flex min-h-0 cursor-pointer flex-col gap-1 overflow-hidden p-1.5 outline-none transition hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset ' +
                (isHoliday ? 'bg-brand/10' : 'bg-ink')
              }
            >
              <div className="flex items-center justify-between">
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
                <Plus className="h-4 w-4 text-white/30 opacity-0 transition group-hover:opacity-100" />
              </div>

              {visibleHolidays.map((holiday) => (
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

              {visibleEvents.map((event) => (
                <EventChip
                  key={event.id}
                  event={event}
                  onClick={() => setModal({ mode: 'edit', event })}
                />
              ))}

              {hidden > 0 && (
                <button
                  type="button"
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation()
                    setModal({ mode: 'day', date: key })
                  }}
                  className="self-start rounded px-1.5 text-xs font-medium text-white/60 hover:bg-white/5 hover:text-white"
                >
                  +{hidden} mais
                </button>
              )}
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
        <span className="text-white/40">Clique em um dia para criar um evento.</span>
      </div>

      {modal?.mode === 'day' && (
        <Modal title={formatLongDate(modal.date)} onClose={() => setModal(null)}>
          <div className="space-y-2">
            {(holidaysByDay.get(modal.date) ?? []).map((holiday) => (
              <p key={holiday.name} className="text-sm text-brand">
                {holiday.name} ({holiday.optional ? 'ponto facultativo' : 'feriado nacional'})
              </p>
            ))}
            {(eventsByDay.get(modal.date) ?? []).map((event) => (
              <EventChip key={event.id} event={event} large onClick={() => setModal({ mode: 'edit', event })} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setModal({ mode: 'create', date: modal.date })}
            className="mt-5 flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark"
          >
            <Plus className="h-4 w-4" />
            Novo evento neste dia
          </button>
        </Modal>
      )}

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? 'Novo evento' : 'Editar evento'} onClose={() => setModal(null)}>
          <EventForm
            initialValue={modal.mode === 'edit' ? modal.event : undefined}
            initialDate={modal.mode === 'create' ? modal.date : modal.event.date}
            onSave={saveEvent}
            onDelete={modal.mode === 'edit' ? () => deleteEvent(modal.event.id) : undefined}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}

type EventChipProps = {
  event: CalendarEvent
  onClick: () => void
  large?: boolean
}

// Etiqueta de um evento, na cor escolhida pelo usuário
function EventChip({ event, onClick, large = false }: EventChipProps) {
  const time = event.start ? (event.end ? `${event.start} – ${event.end}` : event.start) : null

  return (
    <button
      type="button"
      title={[event.title, time, event.description].filter(Boolean).join('\n')}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation()
        onClick()
      }}
      className={
        'w-full truncate rounded border-l-2 text-left transition hover:brightness-125 ' +
        (large ? 'px-3 py-2 text-sm' : 'px-1.5 py-0.5 text-xs')
      }
      style={{ backgroundColor: `${event.color}33`, borderColor: event.color }}
    >
      {time && <span className="mr-1 text-white/60">{large ? time : event.start}</span>}
      <span className="font-medium">{event.title}</span>
    </button>
  )
}
