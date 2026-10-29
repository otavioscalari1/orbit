import { Router } from 'express'
import type { Video } from '../generated/prisma/client.ts'
import { getCurrentUser } from '../lib/currentUser.ts'
import { prisma } from '../lib/prisma.ts'
import { extractYoutubeId, fetchYoutubeInfo } from '../lib/youtube.ts'

export const videosRouter = Router()

function toResponse(video: Video) {
  return {
    id: video.id,
    youtubeId: video.youtubeId,
    title: video.title,
    channelName: video.channelName,
    createdAt: video.createdAt.toISOString(),
  }
}

// Lista os vídeos da biblioteca, dos adicionados por último para os mais antigos
videosRouter.get('/', async (_req, res) => {
  const user = await getCurrentUser()
  const videos = await prisma.video.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
  res.json(videos.map(toResponse))
})

// Adiciona um vídeo a partir do link colado: { url: "https://youtu.be/..." }
videosRouter.post('/', async (req, res) => {
  const { url } = (req.body ?? {}) as { url?: unknown }
  const youtubeId = typeof url === 'string' ? extractYoutubeId(url) : null
  if (!youtubeId) {
    res.status(400).json({ error: 'Não reconheci esse link. Cole o endereço de um vídeo do YouTube.' })
    return
  }

  const user = await getCurrentUser()
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
    data: { userId: user.id, youtubeId, title: info.title, channelName: info.channelName },
  })
  res.status(201).json(toResponse(video))
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
