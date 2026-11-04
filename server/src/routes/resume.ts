import express, { Router } from 'express'
import { getCurrentUser } from '../lib/currentUser.ts'
import { prisma } from '../lib/prisma.ts'

export const resumeRouter = Router()

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/ // "AAAA-MM"
const LANGUAGE_LEVELS = ['Básico', 'Intermediário', 'Avançado', 'Fluente', 'Nativo']
const STATES = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
const MAX_ACHIEVEMENTS = 4
const MAX_ACHIEVEMENT_LENGTH = 300
const MAX_SKILLS = 30
const MAX_SKILL_LENGTH = 60

// Regra de cada campo: número = texto com até esse tamanho; lista = só aceita esses valores (ou vazio)
type FieldRule = number | string[] | 'month' | 'flag' | 'achievements'
type FieldRules = Record<string, FieldRule>

// Os limites abaixo são os mesmos do formulário (client/src/lib/resume.ts)
const CONTACT_RULES: FieldRules = {
  fullName: 120,
  city: 80,
  state: STATES,
  phone: 30,
  email: 150,
  linkedin: 200,
  portfolio: 200,
}

const LIST_SECTIONS: Record<string, { label: string; max: number; rules: FieldRules }> = {
  education: {
    label: 'Formação',
    max: 10,
    rules: { id: 64, course: 150, institution: 150, semester: 30, startDate: 'month', endDate: 'month' },
  },
  languages: {
    label: 'Idiomas',
    max: 10,
    rules: { id: 64, name: 60, level: LANGUAGE_LEVELS },
  },
  experience: {
    label: 'Experiência',
    max: 15,
    rules: {
      id: 64,
      company: 150,
      role: 150,
      location: 100,
      startDate: 'month',
      endDate: 'month',
      current: 'flag',
      achievements: 'achievements',
    },
  },
  projects: {
    label: 'Projetos',
    max: 15,
    rules: { id: 64, name: 150, description: 500, technologies: 200, link: 200 },
  },
  activities: {
    label: 'Atividades',
    max: 15,
    rules: {
      id: 64,
      name: 150,
      organization: 150,
      description: 500,
      startDate: 'month',
      endDate: 'month',
      current: 'flag',
    },
  },
  courses: {
    label: 'Cursos e certificações',
    max: 20,
    rules: { id: 64, name: 150, institution: 150, year: 4 },
  },
}

function isFieldValid(field: unknown, rule: FieldRule) {
  if (rule === 'flag') return typeof field === 'boolean'
  if (rule === 'achievements') {
    return (
      Array.isArray(field) &&
      field.length <= MAX_ACHIEVEMENTS &&
      field.every((line) => typeof line === 'string' && line.length <= MAX_ACHIEVEMENT_LENGTH)
    )
  }
  if (typeof field !== 'string') return false
  if (rule === 'month') return field === '' || MONTH_PATTERN.test(field)
  if (typeof rule === 'number') return field.length <= rule
  return field === '' || rule.includes(field)
}

// Confere os campos de um objeto. Retorna só os campos conhecidos, ou null se algum for inválido.
function parseFields(value: unknown, rules: FieldRules) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [key, rule] of Object.entries(rules)) {
    if (!isFieldValid(source[key], rule)) return null
    result[key] = source[key]
  }
  return result
}

// Valida o currículo enviado pelo frontend. Retorna o conteúdo ou uma mensagem de erro.
// Campos vazios são aceitos: o currículo é salvo aos poucos, enquanto a pessoa preenche.
// A regra do que é obrigatório para baixar fica no frontend, que é onde o PDF é gerado.
function parseContent(value: unknown): Record<string, unknown> | string {
  const { contact: rawContact, objective, summary, skills } = (value ?? {}) as Record<string, unknown>

  const contact = parseFields(rawContact, CONTACT_RULES)
  if (!contact) return 'Confira a seção Contato.'
  if (typeof objective !== 'string' || objective.length > 120) return 'Confira o campo Objetivo.'
  if (typeof summary !== 'string' || summary.length > 400) return 'Confira o campo Resumo.'
  if (
    !Array.isArray(skills) ||
    skills.length > MAX_SKILLS ||
    !skills.every((skill) => typeof skill === 'string' && skill.length <= MAX_SKILL_LENGTH)
  ) {
    return 'Confira a seção Habilidades.'
  }

  const content: Record<string, unknown> = { contact, objective, summary, skills }
  for (const [key, { label, max, rules }] of Object.entries(LIST_SECTIONS)) {
    const items = ((value ?? {}) as Record<string, unknown>)[key]
    if (!Array.isArray(items) || items.length > max) return `Confira a seção ${label}.`
    const parsed = items.map((item) => parseFields(item, rules))
    if (parsed.includes(null)) return `Confira a seção ${label}.`
    content[key] = parsed
  }
  return content
}

// Retorna o currículo. Quem ainda não salvou nada recebe content vazio.
resumeRouter.get('/', async (_req, res) => {
  const user = await getCurrentUser()
  const resume = await prisma.resume.findUnique({ where: { userId: user.id }, select: { content: true } })
  // Conta em vez de buscar a foto, para não carregar o arquivo sem necessidade
  const photoCount = await prisma.resume.count({ where: { userId: user.id, photo: { not: null } } })
  res.json({ content: resume?.content ?? {}, hasPhoto: photoCount > 0 })
})

// Salva o currículo inteiro: { content: {...} }
resumeRouter.put('/', async (req, res) => {
  const content = parseContent((req.body ?? {}).content)
  if (typeof content === 'string') {
    res.status(400).json({ error: content })
    return
  }

  const user = await getCurrentUser()
  await prisma.resume.upsert({
    where: { userId: user.id },
    create: { userId: user.id, content: content as object },
    update: { content: content as object, updatedAt: new Date() },
  })
  res.status(204).end()
})

// Recebe a foto já recortada (o arquivo em si, não JSON). Sempre JPEG.
resumeRouter.put('/photo', express.raw({ type: 'image/jpeg', limit: '2mb' }), async (req, res) => {
  // Todo arquivo JPEG começa com os bytes FF D8
  if (!Buffer.isBuffer(req.body) || req.body[0] !== 0xff || req.body[1] !== 0xd8) {
    res.status(400).json({ error: 'Envie a foto em JPEG.' })
    return
  }

  const photo = new Uint8Array(req.body)
  const user = await getCurrentUser()
  await prisma.resume.upsert({
    where: { userId: user.id },
    create: { userId: user.id, photo },
    update: { photo, updatedAt: new Date() },
  })
  res.status(204).end()
})

// Devolve a foto (usada pela tag <img> e pelo PDF)
resumeRouter.get('/photo', async (_req, res) => {
  const user = await getCurrentUser()
  const resume = await prisma.resume.findUnique({ where: { userId: user.id }, select: { photo: true } })
  if (!resume?.photo) {
    res.status(404).json({ error: 'Foto não encontrada.' })
    return
  }

  // A foto pode ser trocada: o navegador não deve guardar uma versão antiga
  res.set('Cache-Control', 'no-store')
  res.type('image/jpeg').send(Buffer.from(resume.photo))
})

// Remove a foto
resumeRouter.delete('/photo', async (_req, res) => {
  const user = await getCurrentUser()
  await prisma.resume.updateMany({ where: { userId: user.id }, data: { photo: null, updatedAt: new Date() } })
  res.status(204).end()
})
