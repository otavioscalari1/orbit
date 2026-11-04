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

export type ChecklistItem = {
  label: string
  done: boolean
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

// Um item recém-adicionado, ainda sem nada escrito, é ignorado no checklist e no PDF
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

const isEducationComplete = (item: ResumeEducation) =>
  filled(item.course, item.institution, item.startDate, item.endDate)
const isLanguageComplete = (item: ResumeLanguage) => filled(item.name, item.level)
const isExperienceComplete = (item: ResumeExperience) =>
  filled(item.company, item.role, item.startDate) &&
  (item.current || filled(item.endDate)) &&
  item.achievements.some((line) => filled(line))
const isProjectComplete = (item: ResumeProject) => filled(item.name, item.description)
const isActivityComplete = (item: ResumeActivity) => filled(item.name, item.description)
const isCourseComplete = (item: ResumeCourse) => filled(item.name, item.institution)

// Itens pela metade travam o download, para nada do que a pessoa escreveu sumir do PDF sem aviso
function entryProblems<T extends object>(label: string, entries: T[], isComplete: (entry: T) => boolean) {
  const problems: ChecklistItem[] = []
  entries.forEach((entry, index) => {
    if (isBlank(entry)) return
    const name = entries.length > 1 ? `${label} ${index + 1}` : label
    const { startDate, endDate } = entry as { startDate?: string; endDate?: string }
    if (!isComplete(entry)) {
      problems.push({ label: `${name}: complete ou remova`, done: false })
    } else if (startDate && endDate && endDate < startDate) {
      problems.push({ label: `${name}: o fim vem antes do início`, done: false })
    }
  })
  return problems
}

function contactMissing({ fullName, city, state, phone, email }: ResumeContact) {
  const missing: string[] = []
  if (!filled(fullName)) missing.push('nome')
  if (!filled(city, state)) missing.push('cidade e estado')
  // DDD + número
  if (phone.replace(/\D/g, '').length < 10) missing.push('telefone com DDD')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) missing.push('e-mail válido')
  return missing
}

// O que precisa estar pronto para liberar o botão "Baixar currículo"
export function getChecklist(content: ResumeContent): ChecklistItem[] {
  const missing = contactMissing(content.contact)
  const skillsLeft = MIN_SKILLS - content.skills.length
  const hasBackground =
    content.experience.some(isExperienceComplete) ||
    content.projects.some(isProjectComplete) ||
    content.activities.some(isActivityComplete)

  return [
    { label: missing.length ? `Contato: falta ${missing.join(', ')}` : 'Contato', done: missing.length === 0 },
    { label: 'Objetivo', done: filled(content.objective) },
    { label: 'Resumo', done: filled(content.summary) },
    { label: 'Formação: pelo menos 1', done: content.education.some(isEducationComplete) },
    {
      label: skillsLeft > 0 ? `Habilidades: ${skillsLeft === 1 ? 'falta 1' : `faltam ${skillsLeft}`}` : 'Habilidades',
      done: skillsLeft <= 0,
    },
    { label: 'Idiomas: pelo menos 1', done: content.languages.some(isLanguageComplete) },
    { label: 'Pelo menos 1 experiência, projeto ou atividade', done: hasBackground },
    ...entryProblems('Formação', content.education, isEducationComplete),
    ...entryProblems('Idioma', content.languages, isLanguageComplete),
    ...entryProblems('Experiência', content.experience, isExperienceComplete),
    ...entryProblems('Projeto', content.projects, isProjectComplete),
    ...entryProblems('Atividade', content.activities, isActivityComplete),
    ...entryProblems('Curso', content.courses, isCourseComplete),
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
