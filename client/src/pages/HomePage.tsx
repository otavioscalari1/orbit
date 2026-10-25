import { AsciiSaturn } from '../components/AsciiSaturn'

const FEATURES = ['Calendário', 'Rotina de aulas', 'Questões', 'Arquivos']

export function HomePage() {
  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col">
      <section className="pt-4">
        <p className="font-mono text-xs uppercase tracking-wider text-brand">• Orbit</p>

        <h1 className="mt-4 max-w-3xl text-5xl leading-[1.05] font-bold tracking-[-0.02em] sm:text-6xl">
          Estudar não precisa ser tão complicado
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
          O Orbit reúne em um só lugar tudo o que gira em torno da sua faculdade: o calendário com provas,
          trabalhos e feriados, a rotina semanal de aulas, questões para revisar e os arquivos importantes de
          cada disciplina. Menos tempo organizando, mais tempo aprendendo.
        </p>

        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-wider text-white/60">
          {FEATURES.map((feature) => (
            <li key={feature}>
              <span className="text-brand">•</span> {feature}
            </li>
          ))}
        </ul>
      </section>

      {/* Saturno ocupa o espaço restante da tela */}
      <AsciiSaturn className="mt-6 min-h-72 flex-1" />
    </div>
  )
}
