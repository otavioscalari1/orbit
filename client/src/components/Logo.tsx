type LogoProps = {
  className?: string
}

// Logo "orbit": "or" branco, "bit" na cor da marca e um anel de Saturno no "o"
export function Logo({ className = '' }: LogoProps) {
  return (
    <span className={'inline-flex items-baseline font-semibold leading-none tracking-tight ' + className}>
      <span className="relative inline-block">
        {/* Metade de trás do anel (fica atrás da letra) */}
        <Ring half="back" />
        <span className="relative z-10">o</span>
        {/* Metade da frente do anel (passa por cima da letra) */}
        <Ring half="front" />
      </span>
      <span>r</span>
      <span className="text-brand">bit</span>
    </span>
  )
}

function Ring({ half }: { half: 'back' | 'front' }) {
  // Elipse inclinada 45°: a parte de cima fica atrás do "o" e a de baixo na frente
  const d = half === 'back' ? 'M -46 0 A 46 13 0 0 1 46 0' : 'M -46 0 A 46 13 0 0 0 46 0'

  return (
    <svg
      viewBox="-50 -50 100 100"
      aria-hidden="true"
      className={
        'pointer-events-none absolute left-1/2 top-[62%] h-[1.05em] w-[1.05em] -translate-x-1/2 -translate-y-1/2 overflow-visible text-brand ' +
        (half === 'front' ? 'z-20' : 'z-0')
      }
    >
      <path d={d} transform="rotate(-45)" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
