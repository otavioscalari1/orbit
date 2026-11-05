// Currículo: formato dos dados e regras do que precisa estar preenchido para liberar o download.

export type ResumeContact = {
  fullName: string
  city: string
  state: string
  phone: string
  email: string
  linkedin: string // opcional
  portfolio: string // opcional
}

export type ResumeEducation = {
  id: string
  course: string
  institution: string
  semester: string // opcional
  startDate: string // "AAAA-MM"
  endDate: string // "AAAA-MM": conclusão ou previsão de conclusão
}

export type ResumeLanguage = {
  id: string
  name: string
  level: string
}

export type ResumeExperience = {
  id: string
  company: string
  role: string
  location: string // opcional
  startDate: string
  endDate: string
  current: boolean // true = ainda trabalha lá (endDate fica vazio)
  achievements: string[]
}

export type ResumeProject = {
  id: string
  name: string
  description: string
  technologies: string // opcional
  link: string // opcional
}

export type ResumeActivity = {
  id: string
  name: string
  organization: string // opcional
  description: string
  startDate: string // opcional
  endDate: string // opcional
  current: boolean
}

export type ResumeCourse = {
  id: string
  name: string
  institution: string
  year: string // opcional
}

export type ResumeContent = {
  contact: ResumeContact
  objective: string
  summary: string
  education: ResumeEducation[]
  skills: string[]
  languages: ResumeLanguage[]
  experience: ResumeExperience[]
  projects: ResumeProject[]
  activities: ResumeActivity[]
  courses: ResumeCourse[]
}

export type ResumeSectionId =
  | 'contact'
  | 'objective'
  | 'summary'
  | 'education'
  | 'skills'
  | 'languages'
  | 'experience'
  | 'projects'
  | 'activities'
  | 'courses'

// Um campo obrigatório que ainda falta, e a seção do formulário onde ele fica
export type MissingField = {
  section: ResumeSectionId
  label: string
}

export const LANGUAGE_LEVELS = ['Básico', 'Intermediário', 'Avançado', 'Fluente', 'Nativo']
export const STATES = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
export const MIN_SKILLS = 3

// Os mesmos limites são conferidos no backend (server/src/routes/resume.ts)
export const MAX_LENGTH = {
  fullName: 120,
  city: 80,
  phone: 30,
  email: 150,
  link: 200,
  title: 150, // curso, instituição, empresa, cargo, nome de projeto...
  location: 100,
  description: 500,
  technologies: 200,
  semester: 30,
  language: 60,
  objective: 120,
  summary: 400,
  achievement: 300,
  skill: 60,
}
export const MAX_ITEMS = {
  education: 10,
  languages: 10,
  experience: 15,
  projects: 15,
  activities: 15,
  courses: 20,
  skills: 30,
  achievements: 4,
}

export function emptyResume(): ResumeContent {
  return {
    contact: { fullName: '', city: '', state: '', phone: '', email: '', linkedin: '', portfolio: '' },
    objective: '',
    summary: '',
    education: [],
    skills: [],
    languages: [],
    experience: [],
    projects: [],
    activities: [],
    courses: [],
  }
}

// O banco pode devolver um conteúdo vazio ou sem algum campo: completa o que faltar
export function normalizeResume(raw: Partial<ResumeContent>): ResumeContent {
  const empty = emptyResume()
  return { ...empty, ...raw, contact: { ...empty.contact, ...raw.contact } }
}

const filled = (...values: string[]) => values.every((value) => value.trim().length > 0)

// Um item recém-adicionado, ainda sem nada escrito, é ignorado na conferência e no PDF
export function isBlank(entry: object) {
  return Object.entries(entry).every(([key, value]) => {
    if (key === 'id' || typeof value === 'boolean') return true
    if (Array.isArray(value)) return value.every((line: string) => !line.trim())
    return !String(value).trim()
  })
}

export function withoutBlank<T extends object>(entries: T[]) {
  return entries.filter((entry) => !isBlank(entry))
}

// Lista os nomes dos campos obrigatórios que faltam em cada tipo de item
const missingInEducation = (item: ResumeEducation) =>
  missingLabels([
    ['Curso', filled(item.course)],
    ['Instituição', filled(item.institution)],
    ['Início', filled(item.startDate)],
    ['Conclusão ou previsão', filled(item.endDate)],
  ])
const missingInLanguage = (item: ResumeLanguage) =>
  missingLabels([
    ['Idioma', filled(item.name)],
    ['Nível', filled(item.level)],
  ])
const missingInExperience = (item: ResumeExperience) =>
  missingLabels([
    ['Cargo', filled(item.role)],
    ['Empresa', filled(item.company)],
    ['Início', filled(item.startDate)],
    ['Fim', item.current || filled(item.endDate)],
    ['pelo menos 1 realização', item.achievements.some((line) => filled(line))],
  ])
const missingInProject = (item: ResumeProject) =>
  missingLabels([
    ['Nome do projeto', filled(item.name)],
    ['Descrição', filled(item.description)],
  ])
const missingInActivity = (item: ResumeActivity) =>
  missingLabels([
    ['Atividade', filled(item.name)],
    ['Descrição', filled(item.description)],
  ])
const missingInCourse = (item: ResumeCourse) =>
  missingLabels([
    ['Nome', filled(item.name)],
    ['Instituição', filled(item.institution)],
  ])

function missingLabels(fields: [label: string, ok: boolean][]) {
  return fields.filter(([, ok]) => !ok).map(([label]) => label)
}

// Itens pela metade impedem o download, para nada do que a pessoa escreveu sumir do PDF sem aviso
function entryProblems<T extends object>(
  section: ResumeSectionId,
  label: string,
  entries: T[],
  missingIn: (entry: T) => string[],
) {
  const problems: MissingField[] = []
  entries.forEach((entry, index) => {
    if (isBlank(entry)) return
    const name = entries.length > 1 ? `${label} ${index + 1}` : label
    const missing = missingIn(entry)
    const { startDate, endDate } = entry as { startDate?: string; endDate?: string }
    if (missing.length > 0) {
      problems.push({ section, label: `${name}: falta ${missing.join(', ')}` })
    } else if (startDate && endDate && endDate < startDate) {
      problems.push({ section, label: `${name}: o fim vem antes do início` })
    }
  })
  return problems
}

// O que falta para poder baixar o currículo. Lista vazia = pode baixar.
export function getMissingFields(content: ResumeContent): MissingField[] {
  const { contact } = content
  const missing: MissingField[] = []
  const require = (section: ResumeSectionId, label: string, ok: boolean) => {
    if (!ok) missing.push({ section, label })
  }

  require('contact', 'Nome completo', filled(contact.fullName))
  require('contact', 'Cidade', filled(contact.city))
  require('contact', 'Estado', filled(contact.state))
  // DDD + número
  require('contact', 'Telefone com DDD', contact.phone.replace(/\D/g, '').length >= 10)
  require('contact', 'E-mail válido', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()))
  require('objective', 'Objetivo', filled(content.objective))
  require('summary', 'Resumo', filled(content.summary))
  // Se já existe um item pela metade, o aviso dele (mais abaixo) diz exatamente o que falta
  require('education', 'Formação: adicione pelo menos 1', withoutBlank(content.education).length > 0)
  const skillsLeft = MIN_SKILLS - content.skills.length
  require('skills', `Habilidades: ${skillsLeft === 1 ? 'falta 1' : `faltam ${skillsLeft}`}`, skillsLeft <= 0)
  require('languages', 'Idiomas: adicione pelo menos 1', withoutBlank(content.languages).length > 0)
  require(
    'experience',
    'Adicione pelo menos 1 experiência, projeto ou atividade',
    withoutBlank(content.experience).length + withoutBlank(content.projects).length + withoutBlank(content.activities).length > 0,
  )

  return [
    ...missing,
    ...entryProblems('education', 'Formação', content.education, missingInEducation),
    ...entryProblems('languages', 'Idioma', content.languages, missingInLanguage),
    ...entryProblems('experience', 'Experiência', content.experience, missingInExperience),
    ...entryProblems('projects', 'Projeto', content.projects, missingInProject),
    ...entryProblems('activities', 'Atividade', content.activities, missingInActivity),
    ...entryProblems('courses', 'Curso', content.courses, missingInCourse),
  ]
}

const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// "2024-03" vira "mar/2024"
export function formatMonth(value: string) {
  if (!value) return ''
  const [year, month] = value.split('-')
  return `${MONTH_NAMES[Number(month) - 1]}/${year}`
}

// Ex.: "mar/2024 – atual", "mar/2024 – dez/2025"
export function formatPeriod(start: string, end: string, current = false) {
  return [formatMonth(start), current ? 'atual' : formatMonth(end)].filter(Boolean).join(' – ')
}
