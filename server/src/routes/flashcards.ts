import { Router } from 'express'
import { getCurrentUser } from '../lib/currentUser.ts'
import { endOfToday, GRADES, previewIntervals, scheduleReview, startOfDayIn, type Grade } from '../lib/flashcards.ts'
import { prisma } from '../lib/prisma.ts'

export const flashcardsRouter = Router()

const MAX_SESSION_CARDS = 200

// Quantos flashcards vencem hoje e quantos existem no total (usado na Home e na aba Revisão)
flashcardsRouter.get('/summary', async (_req, res) => {
  const user = await getCurrentUser()
  const [dueToday, total] = await Promise.all([
    prisma.flashcard.count({ where: { userId: user.id, dueAt: { lt: endOfToday() } } }),
    prisma.flashcard.count({ where: { userId: user.id } }),
  ])
  res.json({ dueToday, total })
})

// Flashcards para revisar hoje. ?folder=all (padrão), none ("Sem pasta") ou o id de uma pasta de vídeos.
flashcardsRouter.get('/due', async (req, res) => {
  const user = await getCurrentUser()
  const folder = typeof req.query.folder === 'string' ? req.query.folder : 'all'
  const videoFilter = folder === 'all' ? {} : { video: { folderId: folder === 'none' ? null : folder } }

  const cards = await prisma.flashcard.findMany({
    where: { userId: user.id, dueAt: { lt: endOfToday() }, ...videoFilter },
    include: { video: { select: { id: true, youtubeId: true, title: true, channelName: true, folderId: true } } },
    // Os mais atrasados primeiro
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    take: MAX_SESSION_CARDS,
  })

  res.json(
    cards.map((card) => ({
      id: card.id,
      question: card.question,
      answer: card.answer,
      videoSeconds: card.videoSeconds,
      isNew: card.lastReviewedAt === null,
      video: card.video,
      previews: previewIntervals(card),
    })),
  )
})

// Registra a resposta do aluno: { grade: "again" | "hard" | "good" | "easy" }
flashcardsRouter.post('/:id/review', async (req, res) => {
  const { grade } = (req.body ?? {}) as { grade?: unknown }
  if (!GRADES.includes(grade as Grade)) {
    res.status(400).json({ error: 'Resposta inválida.' })
    return
  }

  const user = await getCurrentUser()
  const card = await prisma.flashcard.findFirst({ where: { id: req.params.id, userId: user.id } })
  if (!card) {
    res.status(404).json({ error: 'Flashcard não encontrado.' })
    return
  }

  const next = scheduleReview(card, grade as Grade)
  const now = new Date()
  const updated = await prisma.flashcard.update({
    where: { id: card.id },
    data: { ...next, dueAt: startOfDayIn(next.intervalDays, now), lastReviewedAt: now, updatedAt: now },
  })
  res.json({ intervalDays: updated.intervalDays, dueAt: updated.dueAt.toISOString() })
})
