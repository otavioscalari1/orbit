import type { Video } from './videos'

export type Grade = 'again' | 'hard' | 'good' | 'easy'

// Flashcard que vence hoje, com o vídeo de onde veio
export type DueFlashcard = {
  id: string
  question: string
  answer: string
  videoSeconds: number | null // momento do vídeo em que a linha foi marcada
  isNew: boolean // nunca revisado
  video: Pick<Video, 'id' | 'youtubeId' | 'title' | 'channelName' | 'folderId'>
  previews: Record<Grade, number> // em quantos dias volta, para cada botão
}

export type FlashcardSummary = { dueToday: number; total: number }

export const GRADE_BUTTONS: { grade: Grade; label: string; key: string }[] = [
  { grade: 'again', label: 'Errei', key: '1' },
  { grade: 'hard', label: 'Difícil', key: '2' },
  { grade: 'good', label: 'Bom', key: '3' },
  { grade: 'easy', label: 'Fácil', key: '4' },
]

// 1 -> "1 dia"; 8 -> "8 dias"; 45 -> "1,5 mês"
export function formatInterval(days: number): string {
  if (days < 30) return days === 1 ? '1 dia' : `${days} dias`
  const months = days / 30
  if (months < 12) return `${months.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${months < 2 ? 'mês' : 'meses'}`
  const years = days / 365
  return `${years.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${years < 2 ? 'ano' : 'anos'}`
}

// Mesma regra do backend (server/src/lib/flashcards.ts), só para mostrar a lista no player:
// cada linha "pergunta :: resposta" vira um flashcard; pergunta repetida conta uma vez.
export function parseFlashcardLines(notes: string): { question: string; answer: string }[] {
  const seen = new Set<string>()
  const cards: { question: string; answer: string }[] = []
  for (const rawLine of notes.split('\n')) {
    const line = rawLine
      .trim()
      .replace(/^\[(?:\d{1,2}:)?\d{1,2}:\d{2}\]\s*/, '')
      .replace(/^[-*•]\s+/, '')
    const index = line.indexOf('::')
    if (index === -1) continue
    const question = line.slice(0, index).trim()
    const answer = line.slice(index + 2).trim()
    const key = question.replace(/\s+/g, ' ').toLowerCase()
    if (!question || !answer || question.length > 1000 || answer.length > 5000 || seen.has(key)) continue
    seen.add(key)
    cards.push({ question, answer })
  }
  return cards
}
