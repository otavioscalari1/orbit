import { Router } from 'express'
import type { Video } from '../generated/prisma/client.ts'
import { getCurrentUser } from '../lib/currentUser.ts'
import { prisma } from '../lib/prisma.ts'
import { extractYoutubeId, fetchYoutubeInfo } from '../lib/youtube.ts'

export const videosRouter = Router()

const MAX_NOTES_LENGTH = 200_000

// As notas não vão na lista (podem ser grandes): são buscadas só ao abrir o vídeo
function toResponse(video: Omit<Video, 'notes'>) {
  return {
    id: video.id,
    youtubeId: video.youtubeId,
    title: video.title,
    channelName: video.channelName,
    folderId: video.folderId,
    createdAt: video.createdAt.toISOString(),
  }
}

// Confere a pasta escolhida: null/ausente = "Sem pasta"; senão precisa ser uma pasta do usuário.
// Retorna o id da pasta (ou null) ou uma mensagem de erro.
async function parseFolderId(value: unknown, userId: string): Promise<string | null | { error: string }> {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return { error: 'Pasta inválida.' }
  const folder = await prisma.videoFolder.findFirst({ where: { id: value, userId } }).catch(() => null)
  return folder ? folder.id : { error: 'Pasta não encontrada.' }
}

// Lista os vídeos da biblioteca, dos adicionados por último para os mais antigos
videosRouter.get('/', async (_req, res) => {
  const user = await getCurrentUser()
  const videos = await prisma.video.findMany({
    where: { userId: user.id },
    omit: { notes: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(videos.map(toResponse))
})

// Adiciona um vídeo a partir do link colado: { url: "https://youtu.be/...", folderId?: "..." }
videosRouter.post('/', async (req, res) => {
  const { url, folderId: rawFolderId } = (req.body ?? {}) as { url?: unknown; folderId?: unknown }
  const youtubeId = typeof url === 'string' ? extractYoutubeId(url) : null
  if (!youtubeId) {
    res.status(400).json({ error: 'Não reconheci esse link. Cole o endereço de um vídeo do YouTube.' })
    return
  }

  const user = await getCurrentUser()
  const folderId = await parseFolderId(rawFolderId, user.id)
  if (folderId !== null && typeof folderId !== 'string') {
    res.status(400).json(folderId)
    return
  }

  const existing = await prisma.video.findFirst({ where: { userId: user.id, youtubeId } })
  if (existing) {
    res.status(409).json({ error: 'Esse vídeo já está na sua biblioteca.' })
    return
  }

  let info
  try {
    info = await fetchYoutubeInfo(youtubeId)
  } catch {
    res.status(502).json({ error: 'Não foi possível falar com o YouTube agora. Tente de novo em instantes.' })
    return
  }
  if (!info) {
    res.status(400).json({ error: 'Esse vídeo não existe, é privado ou não pode ser exibido fora do YouTube.' })
    return
  }

  const video = await prisma.video.create({
    data: { userId: user.id, youtubeId, title: info.title, channelName: info.channelName, folderId },
  })
  res.status(201).json(toResponse(video))
})

// Move um vídeo para outra pasta: { folderId: "..." } ou { folderId: null } para "Sem pasta"
videosRouter.patch('/:id', async (req, res) => {
  const user = await getCurrentUser()
  const video = await prisma.video.findFirst({ where: { id: req.params.id, userId: user.id } })
  if (!video) {
    res.status(404).json({ error: 'Vídeo não encontrado.' })
    return
  }

  const folderId = await parseFolderId((req.body ?? {}).folderId, user.id)
  if (folderId !== null && typeof folderId !== 'string') {
    res.status(400).json(folderId)
    return
  }

  const updated = await prisma.video.update({ where: { id: video.id }, data: { folderId }, omit: { notes: true } })
  res.json(toResponse(updated))
})

// Remove um vídeo da biblioteca
videosRouter.delete('/:id', async (req, res) => {
  const user = await getCurrentUser()
  const { count } = await prisma.video.deleteMany({ where: { id: req.params.id, userId: user.id } })
  if (count === 0) {
    res.status(404).json({ error: 'Vídeo não encontrado.' })
    return
  }
  res.status(204).end()
})

// Bloco de notas do vídeo: { notes: "..." }
videosRouter.get('/:id/notes', async (req, res) => {
  const user = await getCurrentUser()
  const video = await prisma.video.findFirst({ where: { id: req.params.id, userId: user.id }, select: { notes: true } })
  if (!video) {
    res.status(404).json({ error: 'Vídeo não encontrado.' })
    return
  }
  res.json({ notes: video.notes })
})

// Salva o bloco de notas do vídeo: { notes: "..." } (até 200.000 caracteres)
videosRouter.put('/:id/notes', async (req, res) => {
  const { notes } = (req.body ?? {}) as { notes?: unknown }
  if (typeof notes !== 'string') {
    res.status(400).json({ error: 'Notas inválidas.' })
    return
  }
  // Conta caracteres de verdade (emojis e acentos contam como 1, igual ao banco)
  if ([...notes].length > MAX_NOTES_LENGTH) {
    res.status(400).json({ error: 'As notas podem ter no máximo 200.000 caracteres.' })
    return
  }

  const user = await getCurrentUser()
  const { count } = await prisma.video.updateMany({ where: { id: req.params.id, userId: user.id }, data: { notes } })
  if (count === 0) {
    res.status(404).json({ error: 'Vídeo não encontrado.' })
    return
  }
  res.status(204).end()
})
