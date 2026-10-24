import { Router } from 'express'
import { getCurrentUser } from '../lib/currentUser.ts'
import { prisma } from '../lib/prisma.ts'

export const timeWindowRouter = Router()

// Retorna a janela de horário do usuário, ou null se ainda não foi definida
timeWindowRouter.get('/', async (_req, res) => {
  const user = await getCurrentUser()
  if (user.dayStartHour === null || user.dayEndHour === null) {
    res.json(null)
    return
  }
  res.json({ startHour: user.dayStartHour, endHour: user.dayEndHour })
})

// Salva a janela de horário: { startHour: 8, endHour: 23 }
timeWindowRouter.put('/', async (req, res) => {
  const { startHour, endHour } = req.body as { startHour?: unknown; endHour?: unknown }

  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    (startHour as number) < 0 ||
    (startHour as number) > 23 ||
    (endHour as number) < 1 ||
    (endHour as number) > 24 ||
    (endHour as number) <= (startHour as number)
  ) {
    res.status(400).json({ error: 'Janela de horário inválida.' })
    return
  }

  const user = await getCurrentUser()
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { dayStartHour: startHour as number, dayEndHour: endHour as number },
  })
  res.json({ startHour: updated.dayStartHour, endHour: updated.dayEndHour })
})
