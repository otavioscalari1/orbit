import { Logo } from './components/Logo'

function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <Logo className="text-8xl sm:text-9xl" />

      <p className="max-w-md text-lg text-white/70">
        Sua faculdade organizada em um só lugar: calendário, questões e arquivos.
      </p>

      <div className="flex gap-3">
        <button className="rounded-xl bg-brand px-6 py-3 font-semibold text-ink transition hover:bg-brand-dark">
          Começar
        </button>
        <button className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-brand hover:text-brand">
          Saiba mais
        </button>
      </div>
    </main>
  )
}

export default App
