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
export function videoEmbedUrl(youtubeId: string) {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`
}

// Link para abrir o vídeo no próprio YouTube
export function videoWatchUrl(youtubeId: string) {
  return `https://www.youtube.com/watch?v=${youtubeId}`
}
