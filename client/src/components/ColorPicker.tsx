import { CLASS_COLORS } from '../lib/schedule'

type ColorPickerProps = {
  value: string
  onChange: (color: string) => void
}

// Cores prontas + um círculo tracejado que abre o seletor de cor livre
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const isCustom = !CLASS_COLORS.includes(value)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {CLASS_COLORS.map((option) => (
        <button
          key={option}
          type="button"
          aria-label={`Cor ${option}`}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={
            'h-8 w-8 rounded-full transition ' +
            (value === option ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-light' : 'hover:scale-110')
          }
          style={{ backgroundColor: option }}
        />
      ))}
      <label
        title="Escolher outra cor"
        className={
          'relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-dashed border-white/40 ' +
          (isCustom ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-light' : '')
        }
        style={isCustom ? { backgroundColor: value } : undefined}
      >
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}
