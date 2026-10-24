import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { prisma } from './lib/prisma.ts'

const app = express()
const PORT = Number(process.env.PORT ?? 3333)

app.use(cors())
app.use(express.json())

// Verifica se o servidor e o banco estão funcionando
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok' })
  } catch {
    res.status(503).json({ status: 'database_unavailable' })
  }
})

// Lista as disciplinas
app.get('/api/subjects', async (_req, res) => {
  const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } })
  res.json(subjects)
})

// Cria uma disciplina
app.post('/api/subjects', async (req, res) => {
  const { name, color } = req.body as { name?: string; color?: string }
  if (!name) {
    res.status(400).json({ error: 'O nome é obrigatório' })
    return
  }
  const subject = await prisma.subject.create({ data: { name, color } })
  res.status(201).json(subject)
})

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})
