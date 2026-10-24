// O PostgreSQL guarda horários na coluna "time"; o Prisma entrega/recebe isso como Date
// (com data 1970-01-01 em UTC). Estas funções convertem de/para o texto "HH:MM" usado no frontend.

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

// "19:30" -> Date
export function timeToDate(time: string): Date {
  return new Date(`1970-01-01T${time}:00.000Z`)
}

// Date -> "19:30"
export function dateToTime(date: Date): string {
  return date.toISOString().slice(11, 16)
}

// "19:30" -> 1170 (minutos desde a meia-noite)
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}
