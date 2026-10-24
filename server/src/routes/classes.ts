import { Router } from 'express'
import { getCurrentUser } from '../lib/currentUser.ts'
import { prisma } from '../lib/prisma.ts'
import { dateToTime, isValidTime, timeToDate, toMinutes } from '../lib/time.ts'
import type { Prisma } from '../generated/prisma/client.ts'

export const classesRouter = Router()

type ClassWithDays = Prisma.ClassGetPayload<{ include: { days: true } }>

type ClassInput = {
  name: string
  days: number[]
  start: string
  end: string
  color: string
}

// Converte o registro do banco para o formato que o frontend usa
function toResponse(item: ClassWithDays) {
  return {
    id: item.id,
    name: item.name,
    days: item.days.map((day) => day.weekday).sort(),
    start: dateToTime(item.startTime),
    end: dateToTime(item.endTime),
    color: item.color,
  }
}

// Valida o corpo da requisição. Retorna os dados limpos ou uma mensagem de erro.
function parseInput(
  body: unknown,
  timeWindow: { startHour: number | null; endHour: number | null },
): ClassInput | string {
  const { name, days, start, end, color } = (body ?? {}) as Record<string, unknown>

  if (typeof name !== 'string' || !name.trim()) return 'Dê um nome para a aula.'
  if (
    !Array.isArray(days) ||
    days.length === 0 ||
    !days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  ) {
    return 'Escolha pelo menos um dia da semana.'
  }
  if (!isValidTime(start) || !isValidTime(end)) return 'Horário inválido.'
  if (toMinutes(end) <= toMinutes(start)) return 'O horário de fim precisa ser depois do início.'
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) return 'Cor inválida.'

  if (timeWindow.startHour === null || timeWindow.endHour === null) {
    return 'Defina sua janela de horário antes de cadastrar aulas.'
  }
  if (toMinutes(start) < timeWindow.startHour * 60 || toMinutes(end) > timeWindow.endHour * 60) {
    return 'O horário precisa estar dentro da sua janela de horário.'
  }

  return { name: name.trim(), days: [...new Set(days as number[])], start, end, color }
}

// Lista as aulas do usuário
classesRouter.get('/', async (_req, res) => {
  const user = await getCurrentUser()
  const classes = await prisma.class.findMany({
    where: { userId: user.id },
    include: { days: true },
    orderBy: { startTime: 'asc' },
  })
  res.json(classes.map(toResponse))
})

// Cria uma aula
classesRouter.post('/', async (req, res) => {
  const user = await getCurrentUser()
  const input = parseInput(req.body, { startHour: user.dayStartHour, endHour: user.dayEndHour })
  if (typeof input === 'string') {
    res.status(400).json({ error: input })
    return
  }

  const created = await prisma.class.create({
    data: {
      userId: user.id,
      name: input.name,
      startTime: timeToDate(input.start),
      endTime: timeToDate(input.end),
      color: input.color,
      days: { create: input.days.map((weekday) => ({ weekday })) },
    },
    include: { days: true },
  })
  res.status(201).json(toResponse(created))
})

// Atualiza uma aula (inclusive os dias da semana)
classesRouter.put('/:id', async (req, res) => {
  const user = await getCurrentUser()
  const existing = await prisma.class.findFirst({ where: { id: req.params.id, userId: user.id } })
  if (!existing) {
    res.status(404).json({ error: 'Aula não encontrada.' })
    return
  }

  const input = parseInput(req.body, { startHour: user.dayStartHour, endHour: user.dayEndHour })
  if (typeof input === 'string') {
    res.status(400).json({ error: input })
    return
  }

  // Apaga os dias antigos e grava os novos, tudo na mesma operação
  const updated = await prisma.class.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      startTime: timeToDate(input.start),
      endTime: timeToDate(input.end),
      color: input.color,
      days: {
        deleteMany: {},
        create: input.days.map((weekday) => ({ weekday })),
      },
    },
    include: { days: true },
  })
  res.json(toResponse(updated))
})

// Exclui uma aula (os dias dela são apagados junto pelo ON DELETE CASCADE)
classesRouter.delete('/:id', async (req, res) => {
  const user = await getCurrentUser()
  const { count } = await prisma.class.deleteMany({ where: { id: req.params.id, userId: user.id } })
  if (count === 0) {
    res.status(404).json({ error: 'Aula não encontrada.' })
    return
  }
  res.status(204).end()
})
