import { Logo } from '../components/Logo'
import { SaturnBackground } from '../components/SaturnBackground'
import { UpcomingCards } from './home/UpcomingCards'

const FEATURES = ['Calendário', 'Rotina de aulas', 'Questões', 'Arquivos']

export function HomePage() {
  return (
    // A margem negativa desfaz o espaçamento do layout, para o planeta encostar nas bordas.
    // A altura exata e o overflow-hidden garantem que a Home não tenha rolagem.
    <div className="relative -m-6 h-[calc(100%+3rem)] overflow-hidden">
      <SaturnBackground className="absolute inset-0" />

      {/* Texto à esquerda e, em telas largas, os cards de próxima aula/evento à direita.
          Só rola aqui dentro se a janela for pequena demais para caber tudo. */}
      <div className="relative mx-auto grid h-full max-w-7xl content-start gap-8 overflow-y-auto p-6 pt-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
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
    </div>
  )
}
