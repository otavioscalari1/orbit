import type { Prisma } from '../generated/prisma/client.ts'

// ---- 1. Ler as notas: cada linha "pergunta :: resposta" vira um flashcard ----

const MAX_QUESTION_LENGTH = 1000
const MAX_ANSWER_LENGTH = 5000
// Marcação de tempo no começo da linha: [12:34] ou [1:02:03]
const LEADING_TIMESTAMP = /^\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]\s*/

export type ParsedFlashcard = {
  question: string
  answer: string
  questionKey: string
  videoSeconds: number | null
}

// Pergunta "normalizada": é o que identifica o flashcard entre uma edição e outra da nota
export function toQuestionKey(question: string): string {
  return question.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function parseFlashcards(notes: string): ParsedFlashcard[] {
  const cards = new Map<string, ParsedFlashcard>()

  for (const rawLine of notes.split('\n')) {
    let line = rawLine.trim()
    const separator = line.indexOf('::')
    if (separator === -1) continue

    // Momento do vídeo, se a linha começar com uma marcação de tempo
    let videoSeconds: number | null = null
    const timestamp = LEADING_TIMESTAMP.exec(line)
    if (timestamp) {
      const [whole, hours, minutes, seconds] = timestamp
      videoSeconds = Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds)
      line = line.slice(whole.length)
    }

    // Tira marcadores de lista do começo ("- ", "* ", "• ")
    line = line.replace(/^[-*•]\s+/, '')
    const index = line.indexOf('::')
    const question = line.slice(0, index).trim()
    const answer = line.slice(index + 2).trim()
    if (!question || !answer || question.length > MAX_QUESTION_LENGTH || answer.length > MAX_ANSWER_LENGTH) continue

    const questionKey = toQuestionKey(question)
    // Pergunta repetida na mesma nota: vale a primeira
    if (!cards.has(questionKey)) cards.set(questionKey, { question, answer, questionKey, videoSeconds })
  }

  return [...cards.values()]
}

// ---- 2. Sincronizar com o banco ao salvar a nota ----

// Cria, atualiza e remove os flashcards de um vídeo para ficarem iguais às linhas "::" da nota.
// Mudou só a resposta → atualiza e mantém o progresso. Mudou a pergunta → é outro flashcard.
export async function syncVideoFlashcards(
  tx: Prisma.TransactionClient,
  userId: string,
  videoId: string,
  notes: string,
) {
  const parsed = parseFlashcards(notes)
  const existing = await tx.flashcard.findMany({ where: { videoId } })
  const existingByKey = new Map(existing.map((card) => [card.questionKey, card]))
  const parsedKeys = new Set(parsed.map((card) => card.questionKey))

  const removed = existing.filter((card) => !parsedKeys.has(card.questionKey))
  if (removed.length > 0) await tx.flashcard.deleteMany({ where: { id: { in: removed.map((card) => card.id) } } })

  for (const card of parsed) {
    const current = existingByKey.get(card.questionKey)
    if (!current) {
      // Flashcard novo: já fica disponível para revisar hoje
      await tx.flashcard.create({ data: { userId, videoId, ...card } })
    } else if (
      current.question !== card.question ||
      current.answer !== card.answer ||
      current.videoSeconds !== card.videoSeconds
    ) {
      await tx.flashcard.update({
        where: { id: current.id },
        data: { question: card.question, answer: card.answer, videoSeconds: card.videoSeconds, updatedAt: new Date() },
      })
    }
  }
}

// ---- 3. Repetição espaçada (SM-2 simplificado) ----

export const GRADES = ['again', 'hard', 'good', 'easy'] as const
export type Grade = (typeof GRADES)[number]

type ReviewState = { intervalDays: number; easeFactor: number; repetitions: number; lapses: number }

const MIN_EASE = 1.3
const MAX_EASE = 5

// Calcula o novo estado do flashcard depois da resposta do aluno
export function scheduleReview(state: ReviewState, grade: Grade): ReviewState {
  const { intervalDays, easeFactor, repetitions, lapses } = state
  const clampEase = (value: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, value))

  if (grade === 'again') {
    // Errou: volta amanhã e recomeça a sequência
    return { intervalDays: 1, easeFactor: clampEase(easeFactor - 0.2), repetitions: 0, lapses: lapses + 1 }
  }

  // Intervalo de "Bom": 1 dia, depois 3, depois intervalo × facilidade (8, 20, 50...)
  const good = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.round(intervalDays * easeFactor)
  let next: number
  let ease = easeFactor
  if (grade === 'hard') {
    next = repetitions === 0 ? 1 : Math.max(intervalDays + 1, Math.round(intervalDays * 1.2))
    next = Math.min(next, Math.max(1, good - 1)) // "Difícil" nunca passa de "Bom"
    ease = clampEase(easeFactor - 0.15)
  } else if (grade === 'good') {
    next = good
  } else {
    next = Math.max(good + 1, Math.round(good * 1.3)) // "Fácil" sempre passa de "Bom"
    ease = clampEase(easeFactor + 0.15)
  }

  return { intervalDays: Math.max(1, next), easeFactor: ease, repetitions: repetitions + 1, lapses }
}

// Quantos dias cada botão daria (mostrado no botão: "Bom · 8 dias")
export function previewIntervals(state: ReviewState): Record<Grade, number> {
  return Object.fromEntries(GRADES.map((grade) => [grade, scheduleReview(state, grade).intervalDays])) as Record<
    Grade,
    number
  >
}

// Começo do dia (meia-noite) daqui a "days" dias: o flashcard fica disponível o dia todo
export function startOfDayIn(days: number, from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)
}

// Fim do dia de hoje: tudo que vence até aqui entra na revisão de hoje
export function endOfToday(from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
}
