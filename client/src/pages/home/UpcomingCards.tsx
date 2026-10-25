import { ArrowRight, CalendarDays, Clock } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { api } from '../../lib/api'
import type { CalendarEvent } from '../../lib/events'
import { toDateKey } from '../../lib/holidays'
import type { ClassItem } from '../../lib/schedule'
import {
  daysUntil,
  findNextClass,
  findNextEvent,
  findNextHoliday,
  relativeDayLabel,
} from '../../lib/upcoming'

const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

// "2026-11-20" -> "sexta-feira, 20 de novembro"
function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

type Loadable<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }

// Hora atual, atualizada a cada minuto para os cards mudarem sozinhos
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function UpcomingCards({ className = '' }: { className?: string }) {
  const now = useNow()
  const [classes, setClasses] = useState<Loadable<ClassItem[]>>({ status: 'loading' })
  const [events, setEvents] = useState<Loadable<CalendarEvent[]>>({ status: 'loading' })

  useEffect(() => {
    const today = new Date()
    const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())

    api
      .getClasses()
      .then((data) => setClasses({ status: 'ready', data }))
      .catch(() => setClasses({ status: 'error' }))

    // Eventos de hoje até daqui a 1 ano
    api
      .getEvents(toDateKey(today), toDateKey(nextYear))
      .then((data) => setEvents({ status: 'ready', data }))
      .catch(() => setEvents({ status: 'error' }))
  }, [])

  return (
    <div className={'grid gap-4 ' + className}>
      <NextClassCard state={classes} now={now} />
      <NextEventCard state={events} now={now} />
    </div>
  )
}

function NextClassCard({ state, now }: { state: Loadable<ClassItem[]>; now: Date }) {
  const footer = <CardLink to="/calendario/aulas">Ver rotina</CardLink>

  if (state.status !== 'ready') {
    return <Card label="Próxima aula" status={state.status} footer={footer} />
  }

  const next = findNextClass(state.data, now)
  if (!next) {
    return (
      <Card label="Próxima aula" footer={footer}>
        <p className="text-lg font-semibold">Nenhuma aula cadastrada</p>
        <p className="mt-1 text-sm text-white/60">Cadastre sua rotina na aba Aulas.</p>
      </Card>
    )
  }

  const { item, daysAhead, ongoing } = next
  const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead)
  const dayLabel = daysAhead === 0 ? 'Hoje' : daysAhead === 1 ? 'Amanhã' : WEEKDAY_NAMES[nextDate.getDay()]

  return (
    <Card label="Próxima aula" footer={footer}>
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold">{item.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
            <Clock className="h-4 w-4 shrink-0" />
            {ongoing ? (
              <span>
                <span className="font-medium text-brand">Acontecendo agora</span> · até {item.end}
              </span>
            ) : (
              <span>
                <span className="font-medium text-white">{dayLabel}</span> · {item.start} – {item.end}
              </span>
            )}
          </p>
        </div>
      </div>
    </Card>
  )
}

function NextEventCard({ state, now }: { state: Loadable<CalendarEvent[]>; now: Date }) {
  const footer = <CardLink to="/calendario">Ver calendário</CardLink>

  if (state.status !== 'ready') {
    return <Card label="Próximo evento" status={state.status} footer={footer} />
  }

  const event = findNextEvent(state.data, now)

  // Sem eventos criados pelo usuário: mostra o próximo feriado
  if (!event) {
    const holiday = findNextHoliday(now)
    if (!holiday) return <Card label="Próximo feriado" footer={footer} />
    const dateKey = toDateKey(holiday.date)

    return (
      <Card label="Próximo feriado" footer={footer}>
        <div className="flex items-start gap-3">
          <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-brand" />
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold">{holiday.name}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span>
                <span className="font-medium text-white">{relativeDayLabel(daysUntil(dateKey, now))}</span> ·{' '}
                {formatDate(dateKey)}
              </span>
            </p>
            <p className="mt-2 text-xs text-white/40">Você ainda não tem eventos futuros no calendário.</p>
          </div>
        </div>
      </Card>
    )
  }

  const time = event.start ? (event.end ? `${event.start} – ${event.end}` : event.start) : 'Dia inteiro'

  return (
    <Card label="Próximo evento" footer={footer}>
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold">{event.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium text-white">{relativeDayLabel(daysUntil(event.date, now))}</span> ·{' '}
              {formatDate(event.date)} · {time}
            </span>
          </p>
          {event.description && <p className="mt-2 truncate text-xs text-white/50">{event.description}</p>}
        </div>
      </div>
    </Card>
  )
}

type CardProps = {
  label: string
  status?: 'loading' | 'error'
  footer: ReactNode
  children?: ReactNode
}

// Moldura comum dos cards da Home
function Card({ label, status, footer, children }: CardProps) {
  return (
    <section className="flex flex-col rounded-xl border border-white/10 bg-ink-light p-5">
      <h2 className="font-mono text-xs uppercase tracking-wider text-white/50">
        <span className="text-brand">•</span> {label}
      </h2>

      <div className="mt-3 flex-1">
        {status === 'loading' && <p className="text-sm text-white/50">Carregando...</p>}
        {status === 'error' && (
          <p className="text-sm text-rose-400">Não foi possível carregar. Verifique se o backend está rodando.</p>
        )}
        {children}
      </div>

      <div className="mt-4">{footer}</div>
    </section>
  )
}

function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-white">
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  )
}
