import { CheckCircle2, Circle, Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { emptyResume, getChecklist, normalizeResume, type ResumeContent } from '../../lib/resume'
import { downloadResumePdf } from '../../lib/resumePdf'
import { ResumeForm } from './ResumeForm'

const SAVE_DELAY = 800 // ms sem digitar antes de salvar

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }
type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: 'Salvo',
  pending: 'Alterações não salvas...',
  saving: 'Salvando...',
  error: 'Erro ao salvar',
}

// Aba Currículo: formulário à esquerda; checklist e botão de baixar à direita
export function ResumePage() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [content, setContent] = useState<ResumeContent>(emptyResume)
  const [hasPhoto, setHasPhoto] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  // Conteúdo ainda não salvo (null = nada pendente), o salvamento agendado e se há um envio em andamento
  const pending = useRef<ResumeContent | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sending = useRef(false)
  const latestLoad = useRef(0)

  function loadResume() {
    const request = ++latestLoad.current
    setLoad({ status: 'loading' })
    api
      .getResume()
      .then((data) => {
        // Só vale a resposta do último carregamento: uma resposta atrasada apagaria o que já foi digitado
        if (request !== latestLoad.current) return
        setContent(normalizeResume(data.content))
        setHasPhoto(data.hasPhoto)
        setLoad({ status: 'ready' })
      })
      .catch((error: Error) => {
        if (request === latestLoad.current) setLoad({ status: 'error', message: error.message })
      })
  }

  useEffect(() => {
    loadResume()
    return () => {
      latestLoad.current++
    }
  }, [])

  async function flush() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    // Um envio por vez, para uma versão antiga nunca chegar depois de uma nova
    if (sending.current) return
    const value = pending.current
    if (value === null) return
    pending.current = null
    sending.current = true
    setSaveStatus('saving')
    try {
      await api.saveResume(value)
      sending.current = false
      if (pending.current === null) {
        setSaveStatus('saved')
      } else {
        // A pessoa continuou digitando enquanto salvava
        setSaveStatus('pending')
        timer.current = setTimeout(flush, SAVE_DELAY)
      }
    } catch {
      sending.current = false
      if (pending.current === null) pending.current = value
      setSaveStatus('error')
    }
  }

  function handleChange(next: ResumeContent) {
    setContent(next)
    setPageCount(null)
    pending.current = next
    setSaveStatus('pending')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY)
  }

  // Se a aba do navegador for fechada com algo pendente, o navegador pergunta antes.
  // Se a página sumir da tela de outro jeito (ex.: mudar de aba no menu), salva o que faltar.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (pending.current !== null) event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (timer.current) clearTimeout(timer.current)
      if (pending.current !== null) void api.saveResume(pending.current).catch(() => undefined)
    }
  }, [])

  async function handleDownload() {
    setDownloading(true)
    setDownloadError(null)
    try {
      setPageCount(await downloadResumePdf(content, hasPhoto))
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.')
    } finally {
      setDownloading(false)
    }
  }

  const checklist = getChecklist(content)
  const doneCount = checklist.filter((item) => item.done).length
  const ready = doneCount === checklist.length

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Currículo</h1>
        <p className="mt-1 text-sm text-white/60">
          Preencha aos poucos: tudo fica salvo. Quando o essencial estiver pronto, o download é liberado.
        </p>
      </div>

      {load.status === 'loading' && <p className="py-16 text-center text-white/50">Carregando currículo...</p>}

      {load.status === 'error' && (
        <div className="py-16 text-center">
          <p className="text-rose-400">{load.message}</p>
          <button
            type="button"
            onClick={loadResume}
            className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition hover:border-brand hover:text-brand"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {load.status === 'ready' && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ResumeForm content={content} onChange={handleChange} hasPhoto={hasPhoto} onPhotoChange={setHasPhoto} />

          {/* Em telas estreitas o checklist vem primeiro; nas largas, fica fixo ao lado do formulário */}
          <aside className="order-first rounded-2xl border border-white/10 bg-ink-light p-5 lg:sticky lg:top-0 lg:order-last">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs tracking-wider text-white/70 uppercase">
                <span className="text-brand">•</span> Checklist
              </p>
              <span className="text-sm text-white/50">
                {doneCount} de {checklist.length}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-brand transition-all" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
            </div>

            <ul className="mt-4 space-y-2 text-sm">
              {checklist.map((item) => (
                <li key={item.label} className={'flex items-start gap-2 ' + (item.done ? 'text-white/50' : 'text-white/85')}>
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                  )}
                  {item.label}
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={!ready || downloading}
              onClick={handleDownload}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 font-semibold text-ink transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {downloading ? 'Gerando...' : 'Baixar currículo'}
            </button>
            {!ready && <p className="mt-2 text-center text-xs text-white/40">Complete o checklist para liberar o botão.</p>}
            {downloadError && <p className="mt-2 text-center text-sm text-rose-400">{downloadError}</p>}
            {pageCount !== null && pageCount > 1 && (
              <p className="mt-2 text-sm text-amber-300">
                O PDF ficou com {pageCount} páginas. Para uma vaga de início de carreira, o ideal é 1: tente deixar o texto
                mais curto.
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs">
              <span className={saveStatus === 'error' ? 'text-rose-400' : 'text-white/40'}>{SAVE_LABEL[saveStatus]}</span>
              {saveStatus === 'error' && (
                <button type="button" onClick={flush} className="font-medium text-brand hover:text-white">
                  Tentar de novo
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
