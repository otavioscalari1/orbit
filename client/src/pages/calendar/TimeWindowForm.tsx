import { useState, type FormEvent } from 'react'
import { formatHour, type TimeWindow } from '../../lib/schedule'

type TimeWindowFormProps = {
  initialValue: TimeWindow | null
  onSave: (value: TimeWindow) => void
  onCancel?: () => void
}

const HOURS = Array.from({ length: 25 }, (_, hour) => hour)

// Formulário da janela de horário do dia (ex.: 08:00 às 23:00), que vale para todos os dias
export function TimeWindowForm({ initialValue, onSave, onCancel }: TimeWindowFormProps) {
  const [startHour, setStartHour] = useState(initialValue?.startHour ?? 8)
  const [endHour, setEndHour] = useState(initialValue?.endHour ?? 23)

  const isValid = endHour > startHour

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isValid) onSave({ startHour, endHour })
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md rounded-2xl border border-white/10 bg-ink-light p-6">
      <h2 className="text-xl font-semibold">Sua janela de horário</h2>
      <p className="mt-1 text-sm text-white/60">
        Defina o horário em que seu dia começa e termina. Ele vale para os 7 dias da semana.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="text-white/70">Começa às</span>
          <select
            value={startHour}
            onChange={(event) => setStartHour(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 outline-none focus:border-brand"
          >
            {HOURS.slice(0, 24).map((hour) => (
              <option key={hour} value={hour}>
                {formatHour(hour)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-white/70">Termina às</span>
          <select
            value={endHour}
            onChange={(event) => setEndHour(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 outline-none focus:border-brand"
          >
            {HOURS.slice(1).map((hour) => (
              <option key={hour} value={hour}>
                {hour === 24 ? '24:00 (meia-noite)' : formatHour(hour)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!isValid && <p className="mt-3 text-sm text-rose-400">O fim precisa ser depois do começo.</p>}

      <div className="mt-6 flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={!isValid}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-40"
        >
          Salvar
        </button>
      </div>
    </form>
  )
}
