import express, { Router } from 'express'
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

const MAX_ELEMENTS_PER_PAGE = 500
const SHAPES = ['rectangle', 'ellipse', 'triangle', 'line', 'arrow']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

const isColor = (value: unknown) =>
  typeof value === 'string' && (value === 'auto' || /^#[0-9a-fA-F]{6}$/.test(value))
const isNumberBetween = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

// Valida os elementos (imagens, textos e formas) da folha. Retorna a lista ou uma mensagem de erro.
function parseElements(value: unknown): unknown[] | string {
  if (!Array.isArray(value)) return 'Elementos inválidos.'
  if (value.length > MAX_ELEMENTS_PER_PAGE) return 'Esta folha tem elementos demais.'

  for (const element of value) {
    const el = (element ?? {}) as Record<string, unknown>
    if (typeof el.id !== 'string' || el.id.length === 0 || el.id.length > 64) return 'Elemento inválido.'
    // Posição e tamanho em unidades da folha virtual (com folga para algo arrastado para fora)
    if (!['x', 'y', 'w', 'h'].every((key) => isNumberBetween(el[key], -5000, 5000))) {
      return 'Posição de elemento inválida.'
    }

    if (el.type === 'image') {
      if (typeof el.imageId !== 'string' || !UUID_PATTERN.test(el.imageId)) return 'Imagem inválida.'
    } else if (el.type === 'text') {
      if (typeof el.text !== 'string' || el.text.length > 5000) return 'Texto inválido.'
      if (!isColor(el.color) || !isNumberBetween(el.fontSize, 8, 200)) return 'Formato de texto inválido.'
    } else if (el.type === 'shape') {
      if (!SHAPES.includes(el.shape as string)) return 'Forma inválida.'
      if (!isColor(el.color) || !isNumberBetween(el.strokeWidth, 1, 40)) return 'Formato da forma inválido.'
    } else {
      return 'Tipo de elemento inválido.'
    }
  }

  return value
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
  return { id: page.id, position: page.position, strokes: page.strokes, elements: page.elements }
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

// Salva o conteúdo de uma folha: { strokes: [...], elements: [...] }
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
  const elements = parseElements((req.body ?? {}).elements ?? [])
  if (typeof elements === 'string') {
    res.status(400).json({ error: elements })
    return
  }

  const { count } = await prisma.notePage.updateMany({
    where: { id: req.params.pageId, noteId: note.id },
    data: { strokes, elements: elements as object[], updatedAt: new Date() },
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

// Recebe uma imagem (o arquivo em si, não JSON) e guarda no banco. Responde { id }.
notesRouter.post(
  '/:id/images',
  express.raw({ type: IMAGE_TYPES, limit: '8mb' }),
  async (req, res) => {
    const note = await findNote(req.params.id)
    if (!note) {
      res.status(404).json({ error: 'Anotação não encontrada.' })
      return
    }

    const mimeType = req.headers['content-type']?.split(';')[0].trim() ?? ''
    if (!IMAGE_TYPES.includes(mimeType) || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'Envie uma imagem PNG, JPEG, WebP ou GIF.' })
      return
    }

    const image = await prisma.noteImage.create({
      data: { noteId: note.id, mimeType, data: new Uint8Array(req.body) },
      select: { id: true },
    })
    res.status(201).json({ id: image.id })
  },
)

// Devolve o arquivo da imagem (usado pela tag <img> e pelo canvas)
notesRouter.get('/:id/images/:imageId', async (req, res) => {
  const note = await findNote(req.params.id)
  const image =
    note && UUID_PATTERN.test(req.params.imageId)
      ? await prisma.noteImage.findFirst({ where: { id: req.params.imageId, noteId: note.id } })
      : null
  if (!image) {
    res.status(404).json({ error: 'Imagem não encontrada.' })
    return
  }

  // A imagem nunca muda depois de enviada: o navegador pode guardar em cache
  res.set('Cache-Control', 'private, max-age=31536000, immutable')
  res.type(image.mimeType).send(Buffer.from(image.data))
})
