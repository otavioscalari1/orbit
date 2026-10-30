// Controle do player do YouTube pela API oficial (IFrame Player API):
// ler o tempo atual do vídeo e pular para um momento.

export type YoutubePlayer = {
  getCurrentTime(): number
  getDuration(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  destroy(): void
}

type YoutubeApi = {
  Player: new (element: HTMLIFrameElement, options: { events?: { onReady?: () => void } }) => YoutubePlayer
}

declare global {
  interface Window {
    YT?: YoutubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let loading: Promise<YoutubeApi> | null = null

// Carrega o script da API do YouTube uma única vez (as próximas chamadas reaproveitam)
export function loadYoutubeApi(): Promise<YoutubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  loading ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      loading = null
      reject(new Error('Não foi possível carregar o player do YouTube.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

// ---- Marcações de tempo nas notas: [12:34] ou [1:02:03] ----

// Encontra todas as marcações num texto (o "g" permite achar várias)
const TIMESTAMP_PATTERN = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]/g

// 754 segundos -> "12:34"; 3723 -> "1:02:03"
export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function toSeconds(match: RegExpExecArray): number {
  const [, hours, minutes, seconds] = match
  return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds)
}

// Se a posição "index" do texto estiver em cima de uma marcação, devolve os segundos dela
export function findTimestampAt(text: string, index: number): number | null {
  for (const match of text.matchAll(TIMESTAMP_PATTERN)) {
    const start = match.index
    if (index >= start && index <= start + match[0].length) return toSeconds(match)
  }
  return null
}

export type TimestampMarker = { seconds: number; label: string; key: string }

// Lista as marcações do texto com o resto da linha como descrição (ex.: "[12:34] regra da cadeia")
export function extractTimestamps(text: string): TimestampMarker[] {
  const markers: TimestampMarker[] = []
  for (const match of text.matchAll(TIMESTAMP_PATTERN)) {
    const lineEnd = text.indexOf('\n', match.index)
    const rest = text.slice(match.index + match[0].length, lineEnd === -1 ? undefined : lineEnd)
    // A descrição para antes da próxima marcação na mesma linha
    const label = rest.split(/\[(?:\d{1,2}:)?\d{1,2}:\d{2}\]/)[0].trim()
    markers.push({ seconds: toSeconds(match), label, key: `${match.index}` })
  }
  return markers
}
