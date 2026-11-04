import { jsPDF } from 'jspdf'
import { formatPeriod, withoutBlank, type ResumeContent } from './resume'

// Medidas em milímetros (A4)
const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_X = 18
const MARGIN_Y = 15
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const PHOTO_SIZE = 28
const BULLET_INDENT = 3.5

const POINT_TO_MM = 0.3528
const LINE_SPACING = 1.25
const COLOR_TEXT = '#1a1a1a'
const COLOR_MUTED = '#555555'

// Tamanhos de letra testados, do maior para o menor, tentando caber em uma página
const FIT_SCALES = [1, 0.95, 0.9]

// A fonte padrão do PDF só tem os caracteres do alfabeto ocidental (com acentos).
// O que estiver fora disso (emoji, por exemplo) sai do texto para não virar símbolo estranho.
const UNSUPPORTED = /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰ŠŒŽ‘’“”•–—™šœžŸ]/g

function cleanText(text: string) {
  return text
    .normalize('NFC')
    .replace(UNSUPPORTED, (char) => char.normalize('NFD').replace(/\p{M}/gu, '').replace(UNSUPPORTED, ''))
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:!?])/g, '$1') // tira o espaço que sobra quando um emoji sai antes da pontuação
    .trim()
}

const joinParts = (...parts: string[]) => parts.map(cleanText).filter(Boolean).join(' · ')

// Mais recente primeiro: o que ainda está em andamento vem antes de tudo
function sortRecent<T extends { startDate: string; endDate: string; current?: boolean }>(entries: T[]) {
  const key = (entry: T) => `${entry.current ? '9999-99' : entry.endDate}|${entry.startDate}`
  return [...entries].sort((a, b) => key(b).localeCompare(key(a)))
}

type TextOptions = {
  size?: number
  bold?: boolean
  muted?: boolean
  indent?: number
  width?: number
}

// O texto é escrito direto no PDF (não como imagem): dá para selecionar, e os sistemas
// que as empresas usam para ler currículos conseguem entender.
function drawResume(content: ResumeContent, photo: Uint8Array | null, scale: number) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = MARGIN_Y

  function ensureSpace(height: number) {
    if (y + height <= PAGE_HEIGHT - MARGIN_Y) return
    pdf.addPage('a4', 'portrait')
    y = MARGIN_Y
  }

  function setStyle({ size = 10, bold = false, muted = false }: TextOptions) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size * scale)
    pdf.setTextColor(muted ? COLOR_MUTED : COLOR_TEXT)
  }

  function write(text: string, options: TextOptions = {}) {
    const clean = cleanText(text)
    if (!clean) return
    const { size = 10, indent = 0, width = CONTENT_WIDTH - indent } = options
    setStyle(options)
    const lineHeight = size * scale * POINT_TO_MM * LINE_SPACING
    for (const line of pdf.splitTextToSize(clean, width) as string[]) {
      ensureSpace(lineHeight)
      pdf.text(line, MARGIN_X + indent, y, { baseline: 'top' })
      y += lineHeight
    }
  }

  function writeSection(title: string, render: () => void) {
    ensureSpace(16 * scale)
    y += 3.5 * scale
    write(title.toUpperCase(), { size: 10.5, bold: true })
    y += 0.4
    pdf.setDrawColor('#999999')
    pdf.setLineWidth(0.25)
    pdf.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y)
    y += 1.5 * scale
    render()
  }

  // Título do item à esquerda, em negrito, e o período à direita, na mesma linha
  function writeEntryTitle(title: string, period = '') {
    ensureSpace(10 * scale)
    const right = cleanText(period)
    setStyle({ muted: true })
    const rightWidth = right ? pdf.getTextWidth(right) + 4 : 0
    if (right) pdf.text(right, PAGE_WIDTH - MARGIN_X, y, { align: 'right', baseline: 'top' })
    write(title, { bold: true, width: CONTENT_WIDTH - rightWidth })
  }

  // O marcador é escrito antes do texto, para quem lê o PDF automaticamente receber na ordem certa
  function writeBullet(text: string) {
    if (!cleanText(text)) return
    setStyle({})
    ensureSpace(10 * scale * POINT_TO_MM * LINE_SPACING)
    pdf.text('•', MARGIN_X + 0.6, y, { baseline: 'top' })
    write(text, { indent: BULLET_INDENT })
  }

  const entryGap = () => {
    y += 1.5 * scale
  }

  // Cabeçalho: nome, objetivo e contato, com a foto (se tiver) à direita
  const { contact } = content
  const headerWidth = photo ? CONTENT_WIDTH - PHOTO_SIZE - 5 : CONTENT_WIDTH
  if (photo) pdf.addImage(photo, 'JPEG', PAGE_WIDTH - MARGIN_X - PHOTO_SIZE, MARGIN_Y, PHOTO_SIZE, PHOTO_SIZE)
  write(contact.fullName, { size: 20, bold: true, width: headerWidth })
  y += 0.5
  write(content.objective, { size: 11, width: headerWidth })
  y += 1
  write(
    joinParts(`${contact.city.trim()}/${contact.state}`, contact.phone, contact.email, contact.linkedin, contact.portfolio),
    { size: 9.5, muted: true, width: headerWidth },
  )
  if (photo) y = Math.max(y, MARGIN_Y + PHOTO_SIZE)

  writeSection('Resumo', () => write(content.summary))

  const experience = sortRecent(withoutBlank(content.experience))
  const education = sortRecent(withoutBlank(content.education))
  const projects = withoutBlank(content.projects)
  const activities = sortRecent(withoutBlank(content.activities))
  const languages = withoutBlank(content.languages)
  const courses = withoutBlank(content.courses)

  const today = new Date().toISOString().slice(0, 7)

  const sections = {
    experience: () =>
      experience.length > 0 &&
      writeSection('Experiência', () =>
        experience.forEach((item) => {
          writeEntryTitle(item.role, formatPeriod(item.startDate, item.endDate, item.current))
          write(joinParts(item.company, item.location), { muted: true })
          item.achievements.forEach(writeBullet)
          entryGap()
        }),
      ),
    education: () =>
      education.length > 0 &&
      writeSection('Formação', () =>
        education.forEach((item) => {
          const expected = item.endDate > today ? ' (previsão)' : ''
          writeEntryTitle(item.course, formatPeriod(item.startDate, item.endDate) + expected)
          write(joinParts(item.institution, item.semester), { muted: true })
          entryGap()
        }),
      ),
    projects: () =>
      projects.length > 0 &&
      writeSection('Projetos', () =>
        projects.forEach((item) => {
          writeEntryTitle(item.name)
          write(item.description)
          write(joinParts(item.technologies, item.link), { muted: true })
          entryGap()
        }),
      ),
    activities: () =>
      activities.length > 0 &&
      writeSection('Atividades', () =>
        activities.forEach((item) => {
          writeEntryTitle(item.name, formatPeriod(item.startDate, item.endDate, item.current))
          write(item.organization, { muted: true })
          write(item.description)
          entryGap()
        }),
      ),
  }

  // Quem não tem experiência começa pelos projetos, que são o ponto mais forte nesse caso
  const order =
    experience.length > 0
      ? [sections.experience, sections.education, sections.projects, sections.activities]
      : [sections.projects, sections.education, sections.activities]
  order.forEach((render) => render())

  writeSection('Habilidades', () => write(content.skills.map(cleanText).filter(Boolean).join(', ')))
  writeSection('Idiomas', () =>
    write(languages.map((item) => `${cleanText(item.name)} (${item.level.toLowerCase()})`).join(' · ')),
  )
  if (courses.length > 0) {
    writeSection('Cursos e certificações', () =>
      courses.forEach((item) => write(joinParts(item.name, item.institution, item.year))),
    )
  }

  pdf.setProperties({ title: `Currículo - ${cleanText(contact.fullName)}` })
  return pdf
}

// Monta o PDF, diminuindo um pouco a letra se isso fizer tudo caber em uma página.
// Se nem assim couber, mantém o tamanho normal e usa mais páginas.
export function buildResumePdf(content: ResumeContent, photo: Uint8Array | null) {
  for (const scale of FIT_SCALES) {
    const pdf = drawResume(content, photo, scale)
    if (pdf.getNumberOfPages() === 1) return pdf
  }
  return drawResume(content, photo, FIT_SCALES[0])
}

// Gera o PDF e baixa no navegador. Retorna quantas páginas ele ficou.
export async function downloadResumePdf(content: ResumeContent, hasPhoto: boolean) {
  let photo: Uint8Array | null = null
  if (hasPhoto) {
    const response = await fetch('/api/resume/photo')
    if (!response.ok) throw new Error('Não foi possível carregar a foto.')
    photo = new Uint8Array(await response.arrayBuffer())
  }

  const pdf = buildResumePdf(content, photo)
  // Nome do arquivo sem caracteres que o sistema não aceita
  const name = content.contact.fullName.replace(/[\\/:*?"<>|]+/g, '').trim()
  pdf.save(`Currículo - ${name}.pdf`)
  return pdf.getNumberOfPages()
}
