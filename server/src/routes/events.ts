import { Router } from 'express'
import type { Event } from '../generated/prisma/client.ts'
import { getCurrentUser } from '../lib/currentUser.ts'
import { prisma } from '../lib/prisma.ts'
import { dateToTime, isValidTime, timeToDate, toMinutes } from '../lib/time.ts'

export const eventsRouter = Router()

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// "2026-11-20" é uma data de verdade?
function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

// O PostgreSQL guarda a coluna "date"; o Prisma usa Date em UTC. Convertemos de/para "AAAA-MM-DD".
const toDbDate = (value: string) => new Date(`${value}T00:00:00.000Z`)
const fromDbDate = (value: Date) => value.toISOString().slice(0, 10)

type EventInput = {
  title: string
  description: string | null
  date: string
  start: string | null
  end: string | null
  color: string
}

// Converte o registro do banco para o formato que o frontend usa
function toResponse(event: Event) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: fromDbDate(event.eventDate),
    start: event.startTime ? dateToTime(event.startTime) : null,
    end: event.endTime ? dateToTime(event.endTime) : null,
    color: event.color,
  }
}

// Valida o corpo da requisição. Retorna os dados limpos ou uma mensagem de erro.
function parseInput(body: unknown): EventInput | string {
  const { title, description, date, start, end, color } = (body ?? {}) as Record<string, unknown>

  if (typeof title !== 'string' || !title.trim()) return 'Dê um título para o evento.'
  if (description != null && typeof description !== 'string') return 'Descrição inválida.'
  if (!isValidDate(date)) return 'Data inválida.'
  if (start != null && !isValidTime(start)) return 'Horário de início inválido.'
  if (end != null && !isValidTime(end)) return 'Horário de fim inválido.'
  if (end != null && start == null) return 'Informe o horário de início.'
  if (start != null && end != null && toMinutes(end) <= toMinutes(start)) {
    return 'O horário de fim precisa ser depois do início.'
  }
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) return 'Cor inválida.'

  return {
    title: title.trim(),
    description: description?.trim() || null,
    date,
    start: start ?? null,
    end: end ?? null,
    color,
  }
}

function toDbData(input: EventInput) {
  return {
    title: input.title,
    description: input.description,
    eventDate: toDbDate(input.date),
    startTime: input.start ? timeToDate(input.start) : null,
    endTime: input.end ? timeToDate(input.end) : null,
    color: input.color,
  }
}

// Lista os eventos do usuário em um período: /api/events?from=2026-11-01&to=2026-11-30
eventsRouter.get('/', async (req, res) => {
  const { from, to } = req.query
  if (!isValidDate(from) || !isValidDate(to)) {
    res.status(400).json({ error: 'Informe o período com from e to (AAAA-MM-DD).' })
    return
  }

  const user = await getCurrentUser()
  const events = await prisma.event.findMany({
    where: { userId: user.id, eventDate: { gte: toDbDate(from), lte: toDbDate(to) } },
    orderBy: [{ eventDate: 'asc' }, { startTime: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
  })
  res.json(events.map(toResponse))
})

// Cria um evento
eventsRouter.post('/', async (req, res) => {
  const input = parseInput(req.body)
  if (typeof input === 'string') {
    res.status(400).json({ error: input })
    return
  }

  const user = await getCurrentUser()
  const created = await prisma.event.create({ data: { userId: user.id, ...toDbData(input) } })
  res.status(201).json(toResponse(created))
})

// Atualiza um evento
eventsRouter.put('/:id', async (req, res) => {
  const user = await getCurrentUser()
  const existing = await prisma.event.findFirst({ where: { id: req.params.id, userId: user.id } })
  if (!existing) {
    res.status(404).json({ error: 'Evento não encontrado.' })
    return
  }

  const input = parseInput(req.body)
  if (typeof input === 'string') {
    res.status(400).json({ error: input })
    return
  }

  const updated = await prisma.event.update({ where: { id: existing.id }, data: toDbData(input) })
  res.json(toResponse(updated))
})

// Exclui um evento
eventsRouter.delete('/:id', async (req, res) => {
  const user = await getCurrentUser()
  const { count } = await prisma.event.deleteMany({ where: { id: req.params.id, userId: user.id } })
  if (count === 0) {
    res.status(404).json({ error: 'Evento não encontrado.' })
    return
  }
  res.status(204).end()
})
