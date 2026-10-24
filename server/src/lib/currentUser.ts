import { prisma } from './prisma.ts'

// Enquanto o app não tem login, todo mundo usa este usuário padrão.
// Ele é criado automaticamente na primeira vez que for necessário (dados não vão em migrations).
const DEFAULT_USER = {
  name: 'Usuário padrão',
  email: 'usuario@orbit.local',
}

export async function getCurrentUser() {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: DEFAULT_USER.email, mode: 'insensitive' } },
  })
  return existing ?? prisma.user.create({ data: DEFAULT_USER })
}
