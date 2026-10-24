import { useState, type FormEvent } from 'react'
import { CLASS_COLORS, formatHour, toMinutes, WEEK_DAYS, type ClassItem, type TimeWindow } from '../../lib/schedule'

type ClassFormProps = {
  initialValue?: ClassItem
  timeWindow: TimeWindow
  onSave: (value: Omit<ClassItem, 'id'>) => Promise<void>
  onDelete?: () => Promise<void>
  onCancel: () => void
}

// Formulário para criar ou editar uma aula/atividade da semana
export function ClassForm({ initialValue, timeWindow, onSave, onDelete, onCancel }: ClassFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '')
  const [days, setDays] = useState<number[]>(initialValue?.days ?? [])
  const [start, setStart] = useState(initialValue?.start ?? '19:00')
  const [end, setEnd] = useState(initialValue?.end ?? '21:00')
  const [color, setColor] = useState(initialValue?.color ?? CLASS_COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function toggleDay(day: number) {
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]))
  }

  // Executa uma ação no servidor mostrando "salvando" e exibindo o erro, se houver
  async function run(action: () => Promise<void>) {
    setSaving(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.')
      setSaving(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const startMinutes = toMinutes(start)
    const endMinutes = toMinutes(end)

    if (!name.trim()) return setError('Dê um nome para a aula.')
    if (days.length === 0) return setError('Escolha pelo menos um dia da semana.')
    if (endMinutes <= startMinutes) return setError('O horário de fim precisa ser depois do início.')
    if (startMinutes < timeWindow.startHour * 60 || endMinutes > timeWindow.endHour * 60) {
      return setError(
        `O horário precisa estar dentro da sua janela (${formatHour(timeWindow.startHour)} às ${formatHour(timeWindow.endHour)}).`,
      )
    }

    run(() => onSave({ name: name.trim(), days, start, end, color }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block text-sm">
        <span className="text-white/70">Nome</span>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Cálculo 1"
          className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 outline-none placeholder:text-white/30 focus:border-brand"
        />
      </label>

      <fieldset>
        <legend className="text-sm text-white/70">Dias da semana</legend>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {WEEK_DAYS.map(({ day, short, label }) => {
            const selected = days.includes(day)
            return (
              <button
                key={day}
                type="button"
                title={label}
                aria-pressed={selected}
                onClick={() => toggleDay(day)}
                className={
                  'rounded-lg border py-2 text-sm font-medium transition ' +
                  (selected
                    ? 'border-brand bg-brand text-ink'
                    : 'border-white/15 text-white/70 hover:border-brand hover:text-brand')
                }
              >
                {short}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="text-white/70">Início</span>
          <input
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 outline-none focus:border-brand"
          />
        </label>
        <label className="block text-sm">
          <span className="text-white/70">Fim</span>
          <input
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 outline-none focus:border-brand"
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm text-white/70">Cor do card</legend>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {CLASS_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`Cor ${option}`}
              aria-pressed={color === option}
              onClick={() => setColor(option)}
              className={
                'h-8 w-8 rounded-full transition ' +
                (color === option ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-light' : 'hover:scale-110')
              }
              style={{ backgroundColor: option }}
            />
          ))}
          <label
            title="Escolher outra cor"
            className={
              'relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-dashed border-white/40 ' +
              (CLASS_COLORS.includes(color) ? '' : 'ring-2 ring-white ring-offset-2 ring-offset-ink-light')
            }
            style={CLASS_COLORS.includes(color) ? undefined : { backgroundColor: color }}
          >
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </fieldset>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        {onDelete && (
          <button
            type="button"
            disabled={saving}
            onClick={() => run(onDelete)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
          >
            Excluir
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-40"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </form>
  )
}
