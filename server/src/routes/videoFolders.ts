import { Router } from 'express'
import { getCurrentUser } from '../lib/currentUser.ts'
import { prisma } from '../lib/prisma.ts'

export const videoFoldersRouter = Router()

type FolderWithCount = { id: string; name: string; createdAt: Date; _count: { videos: number } }

function toResponse(folder: FolderWithCount) {
  return {
    id: folder.id,
    name: folder.name,
    videoCount: folder._count.videos,
    createdAt: folder.createdAt.toISOString(),
  }
}

// Valida o nome da pasta: retorna o nome limpo ou uma mensagem de erro
function parseName(value: unknown): string | { error: string } {
  if (typeof value !== 'string' || !value.trim()) return { error: 'Dê um nome para a pasta.' }
  if (value.trim().length > 80) return { error: 'O nome da pasta pode ter no máximo 80 caracteres.' }
  return value.trim()
}

// Já existe outra pasta do usuário com esse nome (ignorando maiúsculas)?
async function nameTaken(userId: string, name: string, exceptId?: string) {
  const existing = await prisma.videoFolder.findFirst({
    where: { userId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
  })
  return existing !== null
}

// Lista as pastas em ordem alfabética, com quantos vídeos cada uma tem
videoFoldersRouter.get('/', async (_req, res) => {
  const user = await getCurrentUser()
  const folders = await prisma.videoFolder.findMany({
    where: { userId: user.id },
    include: { _count: { select: { videos: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(folders.map(toResponse))
})

// Cria uma pasta: { name }
videoFoldersRouter.post('/', async (req, res) => {
  const name = parseName((req.body ?? {}).name)
  if (typeof name !== 'string') {
    res.status(400).json(name)
    return
  }

  const user = await getCurrentUser()
  if (await nameTaken(user.id, name)) {
    res.status(409).json({ error: 'Você já tem uma pasta com esse nome.' })
    return
  }

  const folder = await prisma.videoFolder.create({
    data: { userId: user.id, name },
    include: { _count: { select: { videos: true } } },
  })
  res.status(201).json(toResponse(folder))
})

// Renomeia uma pasta: { name }
videoFoldersRouter.patch('/:id', async (req, res) => {
  const user = await getCurrentUser()
  const folder = await prisma.videoFolder.findFirst({ where: { id: req.params.id, userId: user.id } })
  if (!folder) {
    res.status(404).json({ error: 'Pasta não encontrada.' })
    return
  }

  const name = parseName((req.body ?? {}).name)
  if (typeof name !== 'string') {
    res.status(400).json(name)
    return
  }
  if (await nameTaken(user.id, name, folder.id)) {
    res.status(409).json({ error: 'Você já tem uma pasta com esse nome.' })
    return
  }

  const updated = await prisma.videoFolder.update({
    where: { id: folder.id },
    data: { name },
    include: { _count: { select: { videos: true } } },
  })
  res.json(toResponse(updated))
})

// Exclui a pasta. Os vídeos dela NÃO são apagados: voltam para "Sem pasta" (ON DELETE SET NULL).
videoFoldersRouter.delete('/:id', async (req, res) => {
  const user = await getCurrentUser()
  const { count } = await prisma.videoFolder.deleteMany({ where: { id: req.params.id, userId: user.id } })
  if (count === 0) {
    res.status(404).json({ error: 'Pasta não encontrada.' })
    return
  }
  res.status(204).end()
})
