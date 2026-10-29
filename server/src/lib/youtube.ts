// Ajuda com links do YouTube: descobrir o código do vídeo e buscar título/canal.

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']

// Extrai o código de 11 caracteres de um link do YouTube. Aceita:
//   youtube.com/watch?v=ID   youtu.be/ID   youtube.com/shorts/ID
//   youtube.com/embed/ID     youtube.com/live/ID   (e o próprio código colado sozinho)
export function extractYoutubeId(input: string): string | null {
  const value = input.trim()
  if (VIDEO_ID_PATTERN.test(value)) return value

  let url: URL
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  let id: string | null = null
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = url.pathname.split('/')[1] ?? null
  } else if (YOUTUBE_HOSTS.includes(host)) {
    const [, first, second] = url.pathname.split('/')
    if (first === 'watch') id = url.searchParams.get('v')
    else if (['shorts', 'embed', 'live', 'v'].includes(first)) id = second ?? null
  }

  return id && VIDEO_ID_PATTERN.test(id) ? id : null
}

export type YoutubeInfo = { title: string; channelName: string | null }

// Busca título e canal pelo oEmbed do YouTube (endereço público, não precisa de chave).
// Retorna null se o vídeo não existir, for privado ou não puder ser incorporado em outros sites.
export async function fetchYoutubeInfo(youtubeId: string): Promise<YoutubeInfo | null> {
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`
  const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`, {
    signal: AbortSignal.timeout(8000),
  })
  if (response.status === 401 || response.status === 403 || response.status === 404 || response.status === 400) {
    return null
  }
  if (!response.ok) throw new Error(`YouTube respondeu ${response.status}`)

  const data = (await response.json()) as { title?: unknown; author_name?: unknown }
  const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Vídeo do YouTube'
  const channelName = typeof data.author_name === 'string' && data.author_name.trim() ? data.author_name.trim() : null
  return { title, channelName }
}
