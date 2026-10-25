import { useState, type FormEvent } from 'react'
import { ColorPicker } from '../../components/ColorPicker'
import type { CalendarEvent, CalendarEventInput } from '../../lib/events'
import { CLASS_COLORS, toMinutes } from '../../lib/schedule'

type EventFormProps = {
  initialValue?: CalendarEvent
  initialDate: string // "AAAA-MM-DD", usado ao criar
  onSave: (value: CalendarEventInput) => Promise<void>
  onDelete?: () => Promise<void>
  onCancel: () => void
}

const inputClass =
  'mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 outline-none placeholder:text-white/30 focus:border-brand'

// Formulário para criar ou editar um evento do calendário
export function EventForm({ initialValue, initialDate, onSave, onDelete, onCancel }: EventFormProps) {
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [date, setDate] = useState(initialValue?.date ?? initialDate)
  const [allDay, setAllDay] = useState(initialValue ? initialValue.start === null : true)
  const [start, setStart] = useState(initialValue?.start ?? '08:00')
  const [end, setEnd] = useState(initialValue?.end ?? '')
  const [color, setColor] = useState(initialValue?.color ?? CLASS_COLORS[0])
  const [description, setDescription] = useState(initialValue?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

    if (!title.trim()) return setError('Dê um título para o evento.')
    if (!date) return setError('Escolha a data.')
    if (!allDay && !start) return setError('Informe o horário de início.')
    if (!allDay && end && toMinutes(end) <= toMinutes(start)) {
      return setError('O horário de fim precisa ser depois do início.')
    }

    run(() =>
      onSave({
        title: title.trim(),
        description: description.trim() || null,
        date,
        start: allDay ? null : start,
        end: allDay || !end ? null : end,
        color,
      }),
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block text-sm">
        <span className="text-white/70">Título</span>
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ex.: PROVA CÁLCULO"
          className={inputClass}
        />
      </label>

      <label className="block text-sm">
        <span className="text-white/70">Data</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
      </label>

      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Dia inteiro
        </label>

        {!allDay && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-white/70">Início</span>
              <input type="time" value={start} onChange={(event) => setStart(event.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm">
              <span className="text-white/70">Fim (opcional)</span>
              <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} className={inputClass} />
            </label>
          </div>
        )}
      </div>

      <fieldset>
        <legend className="text-sm text-white/70">Cor</legend>
        <div className="mt-2">
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="text-white/70">Descrição (opcional)</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Ex.: Capítulos 1 a 4, levar calculadora"
          className={inputClass + ' resize-none'}
        />
      </label>

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
