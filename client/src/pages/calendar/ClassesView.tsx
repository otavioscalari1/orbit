import { Clock, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { formatHour, toMinutes, WEEK_DAYS, type ClassItem, type TimeWindow } from '../../lib/schedule'
import { ClassForm } from './ClassForm'
import { TimeWindowForm } from './TimeWindowForm'

// Altura de 1 hora na grade, em pixels
const HOUR_HEIGHT = 56

type PositionedClass = {
  item: ClassItem
  lane: number
  lanes: number
}

// Distribui as aulas de um dia em "faixas" para que aulas no mesmo horário fiquem lado a lado
function layoutDay(items: ClassItem[]): PositionedClass[] {
  const sorted = [...items].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  const laneEnds: number[] = []
  const placed = sorted.map((item) => {
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= toMinutes(item.start))
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = toMinutes(item.end)
    return { item, lane }
  })
  return placed.map((entry) => ({ ...entry, lanes: laneEnds.length }))
}

type FormState = { mode: 'create' } | { mode: 'edit'; item: ClassItem } | null

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }

export function ClassesView() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [timeWindow, setTimeWindow] = useState<TimeWindow | null>(null)
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [editingWindow, setEditingWindow] = useState(false)
  const [form, setForm] = useState<FormState>(null)

  // Busca a janela de horário e as aulas no banco (via backend)
  function loadData() {
    setLoad({ status: 'loading' })
    Promise.all([api.getTimeWindow(), api.getClasses()])
      .then(([loadedWindow, loadedClasses]) => {
        setTimeWindow(loadedWindow)
        setClasses(loadedClasses)
        setLoad({ status: 'ready' })
      })
      .catch((error: Error) => setLoad({ status: 'error', message: error.message }))
  }

  useEffect(loadData, [])

  if (load.status === 'loading') {
    return <p className="py-12 text-center text-white/50">Carregando sua rotina...</p>
  }

  if (load.status === 'error') {
    return (
      <div className="py-12 text-center">
        <p className="text-rose-400">{load.message}</p>
        <p className="mt-1 text-sm text-white/50">Verifique se o backend e o banco estão rodando.</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition hover:border-brand hover:text-brand"
        >
          Tentar de novo
        </button>
      </div>
    )
  }

  // Primeiro passo: o usuário precisa definir a janela de horário
  if (!timeWindow || editingWindow) {
    return (
      <TimeWindowForm
        initialValue={timeWindow}
        onSave={async (value) => {
          setTimeWindow(await api.saveTimeWindow(value))
          setEditingWindow(false)
        }}
        onCancel={timeWindow ? () => setEditingWindow(false) : undefined}
      />
    )
  }

  const hours = Array.from(
    { length: timeWindow.endHour - timeWindow.startHour },
    (_, i) => timeWindow.startHour + i,
  )
  const gridHeight = hours.length * HOUR_HEIGHT
  const today = new Date().getDay()

  async function saveClass(value: Omit<ClassItem, 'id'>) {
    if (form?.mode === 'edit') {
      const updated = await api.updateClass(form.item.id, value)
      setClasses((current) => current.map((existing) => (existing.id === updated.id ? updated : existing)))
    } else {
      const created = await api.createClass(value)
      setClasses((current) => [...current, created])
    }
    setForm(null)
  }

  async function deleteClass(id: string) {
    await api.deleteClass(id)
    setClasses((current) => current.filter((existing) => existing.id !== id))
    setForm(null)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Rotina semanal</h1>
          <p className="mt-1 text-sm text-white/60">
            Seu dia vai das {formatHour(timeWindow.startHour)} às {formatHour(timeWindow.endHour)}.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditingWindow(true)}
            className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition hover:border-brand hover:text-brand"
          >
            <Clock className="h-4 w-4" />
            Editar horário
          </button>
          <button
            type="button"
            onClick={() => setForm({ mode: 'create' })}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark"
          >
            <Plus className="h-4 w-4" />
            Nova aula
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <div className="min-w-[48rem]">
          {/* Cabeçalho com os dias da semana */}
          <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-white/10 bg-ink-light">
            <div />
            {WEEK_DAYS.map(({ day, label }) => (
              <div
                key={day}
                className={
                  'py-3 text-center text-sm font-semibold ' + (day === today ? 'text-brand' : 'text-white/70')
                }
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grade de horários */}
          <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))]">
            <div className="relative" style={{ height: gridHeight }}>
              {hours.map((hour, index) => (
                <span
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-xs text-white/40"
                  style={{ top: index * HOUR_HEIGHT }}
                >
                  {index === 0 ? '' : formatHour(hour)}
                </span>
              ))}
            </div>

            {WEEK_DAYS.map(({ day }) => (
              <div
                key={day}
                className={'relative overflow-hidden border-l border-white/10 ' + (day === today ? 'bg-brand/5' : '')}
                style={{
                  height: gridHeight,
                  backgroundImage: 'linear-gradient(to bottom, rgb(255 255 255 / 0.07) 1px, transparent 1px)',
                  backgroundSize: `100% ${HOUR_HEIGHT}px`,
                }}
              >
                {layoutDay(classes.filter((item) => item.days.includes(day))).map(({ item, lane, lanes }) => {
                  const top = ((toMinutes(item.start) - timeWindow.startHour * 60) / 60) * HOUR_HEIGHT
                  const height = ((toMinutes(item.end) - toMinutes(item.start)) / 60) * HOUR_HEIGHT

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setForm({ mode: 'edit', item })}
                      className="absolute overflow-hidden rounded-md border-l-4 px-2 py-1 text-left transition hover:brightness-125"
                      style={{
                        top: top + 1,
                        height: height - 2,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                        backgroundColor: `${item.color}33`,
                        borderColor: item.color,
                      }}
                    >
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="block truncate text-xs text-white/70">
                        {item.start} – {item.end}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {classes.length === 0 && (
        <p className="mt-4 text-center text-sm text-white/50">
          Nenhuma aula cadastrada ainda. Clique em <span className="text-brand">Nova aula</span> para começar.
        </p>
      )}

      {form && (
        <Modal title={form.mode === 'create' ? 'Nova aula' : 'Editar aula'} onClose={() => setForm(null)}>
          <ClassForm
            initialValue={form.mode === 'edit' ? form.item : undefined}
            timeWindow={timeWindow}
            onSave={saveClass}
            onDelete={form.mode === 'edit' ? () => deleteClass(form.item.id) : undefined}
            onCancel={() => setForm(null)}
          />
        </Modal>
      )}
    </div>
  )
}
