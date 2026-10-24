export type Holiday = {
  date: Date
  name: string
  // true = ponto facultativo (ex.: Carnaval), não é feriado nacional oficial
  optional: boolean
}

// Calcula o domingo de Páscoa de um ano (algoritmo de Meeus/Jones/Butcher).
// Os feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi) dependem dela.
function getEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// Feriados nacionais do Brasil (e pontos facultativos nacionais) de um ano
export function getBrazilianHolidays(year: number): Holiday[] {
  const easter = getEasterSunday(year)

  const holidays: Holiday[] = [
    { date: new Date(year, 0, 1), name: 'Confraternização Universal', optional: false },
    { date: addDays(easter, -48), name: 'Carnaval', optional: true },
    { date: addDays(easter, -47), name: 'Carnaval', optional: true },
    { date: addDays(easter, -46), name: 'Quarta-feira de Cinzas', optional: true },
    { date: addDays(easter, -2), name: 'Sexta-feira Santa', optional: false },
    { date: new Date(year, 3, 21), name: 'Tiradentes', optional: false },
    { date: new Date(year, 4, 1), name: 'Dia do Trabalho', optional: false },
    { date: addDays(easter, 60), name: 'Corpus Christi', optional: true },
    { date: new Date(year, 8, 7), name: 'Independência do Brasil', optional: false },
    { date: new Date(year, 9, 12), name: 'Nossa Senhora Aparecida', optional: false },
    { date: new Date(year, 10, 2), name: 'Finados', optional: false },
    { date: new Date(year, 10, 15), name: 'Proclamação da República', optional: false },
    { date: new Date(year, 11, 25), name: 'Natal', optional: false },
  ]

  // Dia da Consciência Negra virou feriado nacional em 2024 (Lei 14.759/2023)
  if (year >= 2024) {
    holidays.push({ date: new Date(year, 10, 20), name: 'Consciência Negra', optional: false })
  }

  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// Chave "AAAA-MM-DD" para comparar dias sem se preocupar com horário
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
