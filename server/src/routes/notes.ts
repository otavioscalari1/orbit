import { Router } from 'express'
import type { Note, NotePage } from '../generated/prisma/client.ts'
import { getCurrentUser } from '../lib/currentUser.ts'
import { prisma } from '../lib/prisma.ts'

export const notesRouter = Router()

const PAPER_THEMES = ['light', 'dark'] as const
const MAX_STROKES_PER_PAGE = 5000
const MAX_POINTS_PER_STROKE = 20000 // números (x e y contam separado)

// Um traço desenhado na folha. Coordenadas na folha "virtual" de 1000 x 1414 (proporção A4).
type Stroke = {
  tool: 'pen' | 'highlighter'
  color: string // "auto" (preto na folha branca / branco na escura) ou "#rrggbb"
  size: number
  points: number[] // [x1, y1, x2, y2, ...]
}

// Valida a lista de traços enviada pelo frontend. Retorna os traços ou uma mensagem de erro.
function parseStrokes(value: unknown): Stroke[] | string {
  if (!Array.isArray(value)) return 'Traços inválidos.'
  if (value.length > MAX_STROKES_PER_PAGE) return 'Esta folha tem traços demais.'

  for (const stroke of value) {
    const { tool, color, size, points } = (stroke ?? {}) as Record<string, unknown>
    if (tool !== 'pen' && tool !== 'highlighter') return 'Ferramenta inválida.'
    if (typeof color !== 'string' || (color !== 'auto' && !/^#[0-9a-fA-F]{6}$/.test(color))) {
      return 'Cor inválida.'
    }
    if (typeof size !== 'number' || !(size > 0 && size <= 100)) return 'Espessura inválida.'
    if (
      !Array.isArray(points) ||
      points.length < 2 ||
      points.length % 2 !== 0 ||
      points.length > MAX_POINTS_PER_STROKE ||
      !points.every((n) => typeof n === 'number' && Number.isFinite(n))
    ) {
      return 'Pontos do traço inválidos.'
    }
  }

  return value as Stroke[]
}

function toNoteSummary(note: Note & { _count: { pages: number } }) {
  return {
    id: note.id,
    title: note.title,
    paperTheme: note.paperTheme,
    pageCount: note._count.pages,
    updatedAt: note.updatedAt.toISOString(),
  }
}

function toPage(page: NotePage) {
  return { id: page.id, position: page.position, strokes: page.strokes }
}

// Busca uma anotação do usuário atual (ou null se não existir / for de outro usuário)
async function findNote(id: string) {
  const user = await getCurrentUser()
  return prisma.note.findFirst({ where: { id, userId: user.id } })
}

// Marca a anotação como alterada agora (para ordenar a lista por "editadas recentemente")
function touchNote(id: string) {
  return prisma.note.update({ where: { id }, data: { updatedAt: new Date() } })
}

// Lista as anotações, das editadas mais recentemente para as mais antigas
notesRouter.get('/', async (_req, res) => {
  const user = await getCurrentUser()
  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    include: { _count: { select: { pages: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  res.json(notes.map(toNoteSummary))
})

// Cria uma anotação já com uma folha em branco
notesRouter.post('/', async (req, res) => {
  const { title } = (req.body ?? {}) as { title?: unknown }
  if (typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'Dê um nome para a anotação.' })
    return
  }

  const user = await getCurrentUser()
  const note = await prisma.note.create({
    data: { userId: user.id, title: title.trim(), pages: { create: { position: 0 } } },
    include: { _count: { select: { pages: true } } },
  })
  res.status(201).json(toNoteSummary(note))
})

// Abre uma anotação com todas as folhas
notesRouter.get('/:id', async (req, res) => {
  const user = await getCurrentUser()
  const note = await prisma.note.findFirst({
    where: { id: req.params.id, userId: user.id },
    include: { pages: { orderBy: { position: 'asc' } } },
  })
  if (!note) {
    res.status(404).json({ error: 'Anotação não encontrada.' })
    return
  }
  res.json({ id: note.id, title: note.title, paperTheme: note.paperTheme, pages: note.pages.map(toPage) })
})

// Renomeia a anotação e/ou troca a cor da folha: { title?, paperTheme? }
notesRouter.patch('/:id', async (req, res) => {
  const note = await findNote(req.params.id)
  if (!note) {
    res.status(404).json({ error: 'Anotação não encontrada.' })
    return
  }

  const { title, paperTheme } = (req.body ?? {}) as { title?: unknown; paperTheme?: unknown }
  const data: { title?: string; paperTheme?: string; updatedAt: Date } = { updatedAt: new Date() }

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'Dê um nome para a anotação.' })
      return
    }
    data.title = title.trim()
  }
  if (paperTheme !== undefined) {
    if (!PAPER_THEMES.includes(paperTheme as (typeof PAPER_THEMES)[number])) {
      res.status(400).json({ error: 'Cor de folha inválida.' })
      return
    }
    data.paperTheme = paperTheme as string
  }

  const updated = await prisma.note.update({ where: { id: note.id }, data })
  res.json({ id: updated.id, title: updated.title, paperTheme: updated.paperTheme })
})

// Exclui a anotação (as folhas vão junto pelo ON DELETE CASCADE)
notesRouter.delete('/:id', async (req, res) => {
  const note = await findNote(req.params.id)
  if (!note) {
    res.status(404).json({ error: 'Anotação não encontrada.' })
    return
  }
  await prisma.note.delete({ where: { id: note.id } })
  res.status(204).end()
})

// Adiciona uma folha em branco logo depois da folha "afterPosition" (ou no fim, se não informado)
notesRouter.post('/:id/pages', async (req, res) => {
  const note = await findNote(req.params.id)
  if (!note) {
    res.status(404).json({ error: 'Anotação não encontrada.' })
    return
  }

  const { afterPosition } = (req.body ?? {}) as { afterPosition?: unknown }
  const pageCount = await prisma.notePage.count({ where: { noteId: note.id } })
  const position =
    Number.isInteger(afterPosition) && (afterPosition as number) >= 0 && (afterPosition as number) < pageCount
      ? (afterPosition as number) + 1
      : pageCount

  const page = await prisma.$transaction(async (tx) => {
    // Empurra para frente as folhas que vêm depois da nova
    await tx.notePage.updateMany({
      where: { noteId: note.id, position: { gte: position } },
      data: { position: { increment: 1 } },
    })
    const created = await tx.notePage.create({ data: { noteId: note.id, position } })
    await tx.note.update({ where: { id: note.id }, data: { updatedAt: new Date() } })
    return created
  })
  res.status(201).json(toPage(page))
})

// Salva os traços de uma folha: { strokes: [...] }
notesRouter.put('/:id/pages/:pageId', async (req, res) => {
  const note = await findNote(req.params.id)
  if (!note) {
    res.status(404).json({ error: 'Anotação não encontrada.' })
    return
  }

  const strokes = parseStrokes((req.body ?? {}).strokes)
  if (typeof strokes === 'string') {
    res.status(400).json({ error: strokes })
    return
  }

  const { count } = await prisma.notePage.updateMany({
    where: { id: req.params.pageId, noteId: note.id },
    data: { strokes, updatedAt: new Date() },
  })
  if (count === 0) {
    res.status(404).json({ error: 'Folha não encontrada.' })
    return
  }
  await touchNote(note.id)
  res.status(204).end()
})

// Remove uma folha e "fecha o buraco" na numeração das seguintes
notesRouter.delete('/:id/pages/:pageId', async (req, res) => {
  const note = await findNote(req.params.id)
  if (!note) {
    res.status(404).json({ error: 'Anotação não encontrada.' })
    return
  }

  const page = await prisma.notePage.findFirst({ where: { id: req.params.pageId, noteId: note.id } })
  if (!page) {
    res.status(404).json({ error: 'Folha não encontrada.' })
    return
  }
  if ((await prisma.notePage.count({ where: { noteId: note.id } })) <= 1) {
    res.status(400).json({ error: 'A anotação precisa ter pelo menos uma folha.' })
    return
  }

  await prisma.$transaction([
    prisma.notePage.delete({ where: { id: page.id } }),
    prisma.notePage.updateMany({
      where: { noteId: note.id, position: { gt: page.position } },
      data: { position: { decrement: 1 } },
    }),
    prisma.note.update({ where: { id: note.id }, data: { updatedAt: new Date() } }),
  ])
  res.status(204).end()
})
