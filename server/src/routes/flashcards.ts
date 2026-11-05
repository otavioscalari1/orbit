import { Router } from 'express'
import { getCurrentUser } from '../lib/currentUser.ts'
import {
  endOfToday,
  GRADES,
  MAX_ANSWER_LENGTH,
  MAX_QUESTION_LENGTH,
  previewIntervals,
  scheduleReview,
  startOfDayIn,
  toQuestionKey,
  type Grade,
} from '../lib/flashcards.ts'
import { prisma } from '../lib/prisma.ts'

export const flashcardsRouter = Router()

const MAX_SESSION_CARDS = 200
const VIDEO_FIELDS = { id: true, youtubeId: true, title: true, channelName: true, folderId: true } as const

type ReviewCard = {
  id: string
  question: string
  answer: string
  videoSeconds: number | null
  lastReviewedAt: Date | null
  intervalDays: number
  easeFactor: number
  repetitions: number
  lapses: number
  video: { id: string; youtubeId: string; title: string; channelName: string | null; folderId: string | null } | null
}

// Formato do flashcard na tela de revisão. video é null nos flashcards criados à mão.
function toDueCard(card: ReviewCard) {
  return {
    id: card.id,
    question: card.question,
    answer: card.answer,
    videoSeconds: card.videoSeconds,
    isNew: card.lastReviewedAt === null,
    video: card.video,
    previews: previewIntervals(card),
  }
}

// Quantos flashcards vencem hoje e quantos existem no total (usado na Home e na aba Revisão)
flashcardsRouter.get('/summary', async (_req, res) => {
  const user = await getCurrentUser()
  const [dueToday, total] = await Promise.all([
    prisma.flashcard.count({ where: { userId: user.id, dueAt: { lt: endOfToday() } } }),
    prisma.flashcard.count({ where: { userId: user.id } }),
  ])
  res.json({ dueToday, total })
})

// Flashcards para revisar hoje. ?folder=all (padrão), manual (criados à mão), none ("Sem pasta") ou o id de uma pasta de vídeos.
flashcardsRouter.get('/due', async (req, res) => {
  const user = await getCurrentUser()
  const folder = typeof req.query.folder === 'string' ? req.query.folder : 'all'
  const originFilter =
    folder === 'all'
      ? {}
      : folder === 'manual'
        ? { videoId: null }
        : { video: { folderId: folder === 'none' ? null : folder } }

  const cards = await prisma.flashcard.findMany({
    where: { userId: user.id, dueAt: { lt: endOfToday() }, ...originFilter },
    include: { video: { select: VIDEO_FIELDS } },
    // Os mais atrasados primeiro
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    take: MAX_SESSION_CARDS,
  })

  res.json(cards.map(toDueCard))
})

// Cria um flashcard à mão, sem vídeo: { question, answer }. Já fica disponível para revisar hoje.
flashcardsRouter.post('/', async (req, res) => {
  const { question, answer } = (req.body ?? {}) as { question?: unknown; answer?: unknown }
  if (typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: 'Escreva a pergunta.' })
    return
  }
  if (typeof answer !== 'string' || !answer.trim()) {
    res.status(400).json({ error: 'Escreva a resposta.' })
    return
  }
  if (question.trim().length > MAX_QUESTION_LENGTH) {
    res.status(400).json({ error: `A pergunta pode ter até ${MAX_QUESTION_LENGTH} caracteres.` })
    return
  }
  if (answer.trim().length > MAX_ANSWER_LENGTH) {
    res.status(400).json({ error: `A resposta pode ter até ${MAX_ANSWER_LENGTH} caracteres.` })
    return
  }

  const user = await getCurrentUser()
  const questionKey = toQuestionKey(question)
  const repeated = await prisma.flashcard.findFirst({ where: { userId: user.id, videoId: null, questionKey } })
  if (repeated) {
    res.status(400).json({ error: 'Você já criou um flashcard com essa pergunta.' })
    return
  }

  const card = await prisma.flashcard.create({
    data: { userId: user.id, question: question.trim(), answer: answer.trim(), questionKey },
    include: { video: { select: VIDEO_FIELDS } },
  })
  res.status(201).json(toDueCard(card))
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
