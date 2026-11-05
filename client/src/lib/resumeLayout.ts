import { jsPDF } from 'jspdf'
import { formatPeriod, withoutBlank, type ResumeContent } from './resume'

// Calcula onde cada texto do currículo fica na folha. O resultado é uma lista de instruções de
// desenho, usada tanto pelo PDF (resumePdf.ts) quanto pela prévia na tela (ResumePreview.tsx).
// Assim as duas nunca ficam diferentes: as quebras de linha e de página são as mesmas.

// Medidas em milímetros (A4)
export const PAGE_WIDTH = 210
export const PAGE_HEIGHT = 297
const MARGIN_X = 18
const MARGIN_Y = 15
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const PHOTO_SIZE = 28
const BULLET_INDENT = 3.5

export const POINT_TO_MM = 0.3528
const LINE_SPACING = 1.25
const ASCENT = 0.8 // distância do topo da linha até a base das letras, em relação ao tamanho da letra

export const COLOR_TEXT = '#1a1a1a'
export const COLOR_MUTED = '#555555'
export const RULE_COLOR = '#999999'
export const RULE_WIDTH = 0.25

// Tamanhos de letra testados, do maior para o menor, tentando caber em uma página
const FIT_SCALES = [1, 0.95, 0.9]

export type ResumeOp =
  | { type: 'text'; text: string; x: number; y: number; size: number; bold: boolean; muted: boolean; alignRight: boolean }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'photo'; x: number; y: number; size: number }

// Uma lista de instruções para cada página
export type ResumeLayout = ResumeOp[][]

// A fonte padrão do PDF só tem os caracteres do alfabeto ocidental (com acentos).
// O que estiver fora disso (emoji, por exemplo) sai do texto para não virar símbolo estranho.
const UNSUPPORTED = /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰ŠŒŽ‘’“”•–—™šœžŸ]/g

export function cleanText(text: string) {
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

// A biblioteca do PDF mede a largura do texto. Uma só instância basta, e a prévia não precisa criar outra a cada tecla.
let measurer: jsPDF | null = null
function getMeasurer() {
  measurer ??= new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  return measurer
}

type TextOptions = {
  size?: number
  bold?: boolean
  muted?: boolean
  indent?: number
  width?: number
}

function layoutAtScale(content: ResumeContent, hasPhoto: boolean, scale: number): ResumeLayout {
  const measure = getMeasurer()
  const pages: ResumeLayout = [[]]
  let y = MARGIN_Y

  const add = (op: ResumeOp) => pages[pages.length - 1].push(op)

  function ensureSpace(height: number) {
    if (y + height <= PAGE_HEIGHT - MARGIN_Y) return
    pages.push([])
    y = MARGIN_Y
  }

  function setMeasureFont(size: number, bold: boolean) {
    measure.setFont('helvetica', bold ? 'bold' : 'normal')
    measure.setFontSize(size)
  }

  function addText(text: string, x: number, size: number, bold: boolean, muted: boolean, alignRight = false) {
    add({ type: 'text', text, x, y: y + size * POINT_TO_MM * ASCENT, size, bold, muted, alignRight })
  }

  function write(text: string, options: TextOptions = {}) {
    const clean = cleanText(text)
    if (!clean) return
    const { bold = false, muted = false, indent = 0, width = CONTENT_WIDTH - indent } = options
    const size = (options.size ?? 10) * scale
    setMeasureFont(size, bold)
    const lineHeight = size * POINT_TO_MM * LINE_SPACING
    for (const line of measure.splitTextToSize(clean, width) as string[]) {
      ensureSpace(lineHeight)
      addText(line, MARGIN_X + indent, size, bold, muted)
      y += lineHeight
    }
  }

  function writeSection(title: string, render: () => void) {
    ensureSpace(16 * scale)
    y += 3.5 * scale
    write(title.toUpperCase(), { size: 10.5, bold: true })
    y += 0.4
    add({ type: 'line', x1: MARGIN_X, y1: y, x2: PAGE_WIDTH - MARGIN_X, y2: y })
    y += 1.5 * scale
    render()
  }

  // Título do item à esquerda, em negrito, e o período à direita, na mesma linha
  function writeEntryTitle(title: string, period = '') {
    ensureSpace(10 * scale)
    const size = 10 * scale
    const right = cleanText(period)
    setMeasureFont(size, false)
    const rightWidth = right ? measure.getTextWidth(right) + 4 : 0
    if (right) addText(right, PAGE_WIDTH - MARGIN_X, size, false, true, true)
    const startY = y
    write(title, { bold: true, width: CONTENT_WIDTH - rightWidth })
    // Item ainda sem título (só a data preenchida): a próxima linha não pode cair em cima da data
    if (y === startY && right) y += size * POINT_TO_MM * LINE_SPACING
  }

  // O marcador é escrito antes do texto, para quem lê o PDF automaticamente receber na ordem certa
  function writeBullet(text: string) {
    if (!cleanText(text)) return
    const size = 10 * scale
    ensureSpace(size * POINT_TO_MM * LINE_SPACING)
    addText('•', MARGIN_X + 0.6, size, false, false)
    write(text, { indent: BULLET_INDENT })
  }

  const entryGap = () => {
    y += 1.5 * scale
  }

  // Cabeçalho: nome, objetivo e contato, com a foto (se tiver) à direita. Sem foto, o texto usa a largura toda.
  const { contact } = content
  const headerWidth = hasPhoto ? CONTENT_WIDTH - PHOTO_SIZE - 5 : CONTENT_WIDTH
  if (hasPhoto) add({ type: 'photo', x: PAGE_WIDTH - MARGIN_X - PHOTO_SIZE, y: MARGIN_Y, size: PHOTO_SIZE })
  write(contact.fullName, { size: 20, bold: true, width: headerWidth })
  y += 0.5
  write(content.objective, { size: 11, width: headerWidth })
  y += 1
  const place = [contact.city.trim(), contact.state].filter(Boolean).join('/')
  write(joinParts(place, contact.phone, contact.email, contact.linkedin, contact.portfolio), {
    size: 9.5,
    muted: true,
    width: headerWidth,
  })
  if (hasPhoto) y = Math.max(y, MARGIN_Y + PHOTO_SIZE)

  if (cleanText(content.summary)) writeSection('Resumo', () => write(content.summary))

  const experience = sortRecent(withoutBlank(content.experience))
  const education = sortRecent(withoutBlank(content.education))
  const projects = withoutBlank(content.projects)
  const activities = sortRecent(withoutBlank(content.activities))
  const skills = content.skills.map(cleanText).filter(Boolean)
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

  if (skills.length > 0) writeSection('Habilidades', () => write(skills.join(', ')))
  if (languages.length > 0) {
    writeSection('Idiomas', () =>
      write(
        languages
          .map((item) => (item.level ? `${cleanText(item.name)} (${item.level.toLowerCase()})` : cleanText(item.name)))
          .join(' · '),
      ),
    )
  }
  if (courses.length > 0) {
    writeSection('Cursos e certificações', () =>
      courses.forEach((item) => write(joinParts(item.name, item.institution, item.year))),
    )
  }

  return pages
}

// Monta o currículo, diminuindo um pouco a letra se isso fizer tudo caber em uma página.
// Se nem assim couber, mantém o tamanho normal e usa mais páginas.
export function layoutResume(content: ResumeContent, hasPhoto: boolean): ResumeLayout {
  for (const scale of FIT_SCALES) {
    const pages = layoutAtScale(content, hasPhoto, scale)
    if (pages.length === 1) return pages
  }
  return layoutAtScale(content, hasPhoto, FIT_SCALES[0])
}
