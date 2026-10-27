import { AsciiSaturn } from '../components/AsciiSaturn'
import { Logo } from '../components/Logo'
import { UpcomingCards } from './home/UpcomingCards'

const FEATURES = ['Calendário', 'Rotina de aulas', 'Questões', 'Arquivos']

export function HomePage() {
  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col">
      {/* Texto à esquerda e, em telas largas, os cards de próxima aula/evento à direita */}
      <div className="grid gap-8 pt-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section>
          <Logo className="text-5xl" />

          <h1 className="mt-6 max-w-2xl text-4xl leading-[1.05] font-bold tracking-[-0.02em] sm:text-5xl">
            Estudar não precisa ser tão complicado
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
            O Orbit reúne em um só lugar tudo o que gira em torno da sua faculdade: o calendário com provas,
            trabalhos e feriados, a rotina semanal de aulas, questões para revisar e os arquivos importantes de
            cada disciplina. Menos tempo organizando, mais tempo aprendendo.
          </p>

          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-wider text-white/60">
            {FEATURES.map((feature) => (
              <li key={feature}>
                <span className="text-brand">•</span> {feature}
              </li>
            ))}
          </ul>
        </section>

        <UpcomingCards className="sm:grid-cols-2 lg:grid-cols-1" />
      </div>

      {/* Saturno ocupa o espaço que sobra embaixo */}
      <AsciiSaturn className="mt-6 min-h-[28rem] flex-1" />
    </div>
  )
}
