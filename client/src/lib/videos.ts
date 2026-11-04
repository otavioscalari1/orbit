// Um vídeo do YouTube salvo na biblioteca do usuário
export type Video = {
  id: string
  youtubeId: string // código de 11 caracteres do vídeo
  title: string
  channelName: string | null
  folderId: string | null // null = "Sem pasta"
  createdAt: string
}

// Pasta para organizar os vídeos
export type VideoFolder = {
  id: string
  name: string
  videoCount: number
  createdAt: string
}

// Miniatura oficial do YouTube (480x360)
export function videoThumbnailUrl(youtubeId: string) {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
}

// Player incorporado. O domínio "youtube-nocookie" não grava cookies de rastreamento até o vídeo tocar.
// enablejsapi=1 permite controlar o player pelo app (ler o tempo atual e pular para um momento).
// startSeconds: começa o vídeo num momento específico (ex.: "Ver no vídeo" de um flashcard)
export function videoEmbedUrl(youtubeId: string, startSeconds?: number | null) {
  const params = new URLSearchParams({ autoplay: '1', rel: '0', enablejsapi: '1', origin: window.location.origin })
  if (startSeconds) params.set('start', String(Math.floor(startSeconds)))
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`
}

// Link para abrir o vídeo no próprio YouTube
export function videoWatchUrl(youtubeId: string) {
  return `https://www.youtube.com/watch?v=${youtubeId}`
}
