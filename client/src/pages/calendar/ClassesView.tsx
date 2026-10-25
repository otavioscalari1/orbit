import { Clock, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { formatHour, toMinutes, WEEK_DAYS, type ClassItem, type TimeWindow } from '../../lib/schedule'
import { ClassForm } from './ClassForm'
import { TimeWindowForm } from './TimeWindowForm'

// Tamanho de cada bloco de horário da grade, em horas
const BLOCK_HOURS = 2

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

  // A grade inteira cabe na tela: cada posição é uma porcentagem da janela de horário
  const windowStart = timeWindow.startHour * 60
  const windowMinutes = (timeWindow.endHour - timeWindow.startHour) * 60
  const toPercent = (minutes: number) => (minutes / windowMinutes) * 100

  // Linhas de 2 em 2 horas (o último bloco pode ser menor, ex.: 22:00–23:00)
  const blockStarts: number[] = []
  for (let hour = timeWindow.startHour; hour < timeWindow.endHour; hour += BLOCK_HOURS) blockStarts.push(hour)

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
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Rotina semanal</h1>
          <p className="mt-1 text-sm text-white/60">
            Seu dia vai das {formatHour(timeWindow.startHour)} às {formatHour(timeWindow.endHour)}.
            {classes.length === 0 && (
              <>
                {' '}Nenhuma aula cadastrada ainda: clique em <span className="text-brand">Nova aula</span> para começar.
              </>
            )}
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

      {/* A grade ocupa todo o espaço que sobra na tela, sem rolagem */}
      <div className="flex min-h-64 flex-1 flex-col overflow-hidden rounded-xl border border-white/10">
        {/* Cabeçalho com os dias da semana */}
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-white/10 bg-ink-light">
          <div />
          {WEEK_DAYS.map(({ day, short, label }) => (
            <div
              key={day}
              className={
                'truncate py-2.5 text-center text-sm font-semibold ' + (day === today ? 'text-brand' : 'text-white/70')
              }
            >
              <span className="lg:hidden">{short}</span>
              <span className="hidden lg:inline">{label}</span>
            </div>
          ))}
        </div>

        {/* Grade de horários */}
        <div className="relative grid min-h-0 flex-1 grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          {/* Linhas horizontais de cada bloco de 2h, atravessando a grade toda */}
          {blockStarts.map((hour) => (
            <div
              key={hour}
              className="pointer-events-none absolute inset-x-0 border-t border-white/10 first:border-t-0"
              style={{ top: `${toPercent(hour * 60 - windowStart)}%` }}
            />
          ))}

          {/* Coluna com os horários */}
          <div className="relative">
            {blockStarts.map((hour) => (
              <span
                key={hour}
                className="absolute right-2 mt-1 text-xs text-white/40"
                style={{ top: `${toPercent(hour * 60 - windowStart)}%` }}
              >
                {formatHour(hour)}
              </span>
            ))}
          </div>

          {WEEK_DAYS.map(({ day }) => (
            <div
              key={day}
              className={'relative overflow-hidden border-l border-white/10 ' + (day === today ? 'bg-brand/5' : '')}
            >
              {layoutDay(classes.filter((item) => item.days.includes(day))).map(({ item, lane, lanes }) => {
                const start = toMinutes(item.start)
                const end = toMinutes(item.end)

                return (
                  <button
                    key={item.id}
                    type="button"
                    title={`${item.name} (${item.start} – ${item.end})`}
                    onClick={() => setForm({ mode: 'edit', item })}
                    className="absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left leading-tight transition hover:brightness-125"
                    style={{
                      top: `calc(${toPercent(start - windowStart)}% + 1px)`,
                      height: `calc(${toPercent(end - start)}% - 2px)`,
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
