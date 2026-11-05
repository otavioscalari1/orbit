import { Plus, Trash2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { isBlank, MAX_ITEMS, MAX_LENGTH, type ResumeSectionId } from '../../lib/resume'

const inputClass =
  'mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 outline-none placeholder:text-white/30 focus:border-brand'

const addButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium transition hover:border-brand hover:text-brand'

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
}

export function TextField({ label, value, onChange, placeholder, maxLength }: FieldProps) {
  return (
    <label className="block text-sm">
      <span className="text-white/70">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={inputClass}
      />
    </label>
  )
}

// Caixa de texto com contador de caracteres
export function TextAreaField({ label, value, onChange, placeholder, maxLength, rows = 3 }: FieldProps & { rows?: number }) {
  return (
    <label className="block text-sm">
      <span className="text-white/70">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={inputClass + ' resize-none'}
      />
      {maxLength && (
        <span className="mt-1 block text-right text-xs text-white/40">
          {value.length}/{maxLength}
        </span>
      )}
    </label>
  )
}

type SelectFieldProps = {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}

export function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="block text-sm">
      <span className="text-white/70">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">Escolha</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const YEARS_BACK = 50
const CURRENT_YEAR = new Date().getFullYear()

type MonthFieldProps = {
  label: string
  value: string // "AAAA-MM" ou vazio
  onChange: (value: string) => void
  futureYears?: number // anos à frente na lista (ex.: previsão de conclusão do curso)
}

// Mês e ano em duas listas. O valor só é enviado quando os dois estão escolhidos.
export function MonthField({ label, value, onChange, futureYears = 0 }: MonthFieldProps) {
  const [year, setYear] = useState(value.slice(0, 4))
  const [month, setMonth] = useState(value.slice(5, 7))

  const lastYear = CURRENT_YEAR + futureYears
  const years = Array.from({ length: YEARS_BACK + futureYears + 1 }, (_, index) => String(lastYear - index))

  function update(nextMonth: string, nextYear: string) {
    setMonth(nextMonth)
    setYear(nextYear)
    onChange(nextMonth && nextYear ? `${nextYear}-${nextMonth}` : '')
  }

  return (
    <fieldset className="text-sm">
      <legend className="text-white/70">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label={`${label}: mês`}
          value={month}
          onChange={(event) => update(event.target.value, year)}
          className={inputClass}
        >
          <option value="">Mês</option>
          {MONTHS.map((name, index) => (
            <option key={name} value={String(index + 1).padStart(2, '0')}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label}: ano`}
          value={year}
          onChange={(event) => update(month, event.target.value)}
          className={inputClass}
        >
          <option value="">Ano</option>
          {years.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  )
}

type SectionProps = {
  id: ResumeSectionId // permite levar a pessoa até esta seção quando falta algo nela
  title: string
  hint?: string
  children: ReactNode
}

// Cartão de uma seção do formulário
export function ResumeSection({ id, title, hint, children }: SectionProps) {
  return (
    <section id={`resume-${id}`} className="rounded-2xl border border-white/10 bg-ink-light p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-white/50">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

type EntryListProps<T extends { id: string }> = {
  items: T[]
  max: number
  addLabel: string
  createItem: () => T
  onChange: (items: T[]) => void
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode
}

// Lista de itens repetíveis (formações, experiências...), com botões de adicionar e remover
export function EntryList<T extends { id: string }>({
  items,
  max,
  addLabel,
  createItem,
  onChange,
  renderItem,
}: EntryListProps<T>) {
  const [removing, setRemoving] = useState<T | null>(null)

  function remove(id: string) {
    onChange(items.filter((item) => item.id !== id))
  }

  // Item com algo escrito pede confirmação, porque o texto não volta depois de removido
  function handleRemove(item: T) {
    if (isBlank(item)) remove(item.id)
    else setRemoving(item)
  }

  return (
    <>
      {items.map((item) => (
        <div key={item.id} className="relative rounded-xl border border-white/10 p-4 pt-10">
          <button
            type="button"
            onClick={() => handleRemove(item)}
            aria-label="Remover"
            className="absolute top-2 right-2 rounded-lg p-1.5 text-white/40 transition hover:bg-rose-500/10 hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="space-y-4">
            {renderItem(item, (patch) =>
              onChange(items.map((current) => (current.id === item.id ? { ...current, ...patch } : current))),
            )}
          </div>
        </div>
      ))}

      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, createItem()])} className={addButtonClass}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      )}

      {removing && (
        <ConfirmDialog
          title="Remover este item?"
          confirmLabel="Remover"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            remove(removing.id)
            setRemoving(null)
          }}
        >
          O que você escreveu nele será apagado.
        </ConfirmDialog>
      )}
    </>
  )
}

type SkillsInputProps = {
  skills: string[]
  onChange: (skills: string[]) => void
}

// Habilidades em etiquetas: escreva e aperte Enter (ou vírgula) para adicionar
export function SkillsInput({ skills, onChange }: SkillsInputProps) {
  const [draft, setDraft] = useState('')

  function addDraft() {
    const next = [...skills]
    for (const part of draft.split(',')) {
      const skill = part.trim()
      const repeated = next.some((current) => current.toLowerCase() === skill.toLowerCase())
      if (skill && !repeated && next.length < MAX_ITEMS.skills) next.push(skill)
    }
    if (next.length !== skills.length) onChange(next)
    setDraft('')
  }

  return (
    <div>
      {skills.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li key={skill} className="inline-flex items-center gap-1 rounded-lg bg-brand/15 py-1 pr-1 pl-2.5 text-sm text-brand">
              {skill}
              <button
                type="button"
                aria-label={`Remover ${skill}`}
                onClick={() => onChange(skills.filter((current) => current !== skill))}
                className="rounded p-0.5 transition hover:bg-brand/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="block text-sm">
        <span className="text-white/70">Adicionar habilidade</span>
        <input
          value={draft}
          maxLength={MAX_LENGTH.skill}
          disabled={skills.length >= MAX_ITEMS.skills}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={addDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addDraft()
            }
          }}
          placeholder="Ex.: Excel, Python, Power BI"
          className={inputClass}
        />
      </label>
      <p className="mt-1 text-xs text-white/40">Aperte Enter ou vírgula para adicionar.</p>
    </div>
  )
}

type AchievementsInputProps = {
  achievements: string[]
  onChange: (achievements: string[]) => void
}

// De 1 a 4 realizações de uma experiência, cada uma em um campo
export function AchievementsInput({ achievements, onChange }: AchievementsInputProps) {
  return (
    <fieldset className="text-sm">
      <legend className="text-white/70">O que você fez e qual foi o resultado</legend>
      <p className="mt-1 text-xs text-white/40">
        Comece com um verbo e, se puder, use números. Em vez de "Responsável por relatórios", escreva "Automatizei os
        relatórios mensais e reduzi o tempo de 2 dias para 2 horas".
      </p>
      <div className="mt-1 space-y-2">
        {achievements.map((line, index) => (
          <div key={index} className="flex items-start gap-2">
            <input
              aria-label={`Realização ${index + 1}`}
              value={line}
              maxLength={MAX_LENGTH.achievement}
              onChange={(event) =>
                onChange(achievements.map((current, i) => (i === index ? event.target.value : current)))
              }
              className={inputClass}
            />
            {achievements.length > 1 && (
              <button
                type="button"
                aria-label={`Remover realização ${index + 1}`}
                onClick={() => onChange(achievements.filter((_, i) => i !== index))}
                className="mt-1 rounded-lg p-2.5 text-white/40 transition hover:bg-rose-500/10 hover:text-rose-400"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {achievements.length < MAX_ITEMS.achievements && (
        <button type="button" onClick={() => onChange([...achievements, ''])} className={addButtonClass + ' mt-3'}>
          <Plus className="h-4 w-4" />
          Adicionar realização
        </button>
      )}
    </fieldset>
  )
}
