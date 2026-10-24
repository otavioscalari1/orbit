import 'dotenv/config'
import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { prisma } from './lib/prisma.ts'
import { classesRouter } from './routes/classes.ts'
import { timeWindowRouter } from './routes/timeWindow.ts'

const app = express()
const PORT = Number(process.env.SERVER_PORT ?? 3333)

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

app.use('/api/time-window', timeWindowRouter)
app.use('/api/classes', classesRouter)

// Qualquer erro não tratado nas rotas cai aqui
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Erro interno no servidor.' })
}
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})
