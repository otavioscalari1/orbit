import { Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { emptyResume, getMissingFields, normalizeResume, type ResumeContent, type ResumeSectionId } from '../../lib/resume'
import { downloadResumePdf } from '../../lib/resumePdf'
import { ResumeForm } from './ResumeForm'
import { ResumePreview } from './ResumePreview'

const SAVE_DELAY = 800 // ms sem digitar antes de salvar

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }
type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: 'Salvo',
  pending: 'Alterações não salvas...',
  saving: 'Salvando...',
  error: 'Erro ao salvar',
}

function scrollToSection(section: ResumeSectionId) {
  document.getElementById(`resume-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Aba Currículo: formulário à esquerda, prévia à direita e o botão de baixar no fim do formulário
export function ResumePage() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [content, setContent] = useState<ResumeContent>(emptyResume)
  const [hasPhoto, setHasPhoto] = useState(false)
  const [photoVersion, setPhotoVersion] = useState(0) // muda o endereço da imagem para mostrar a foto nova
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  // Quantas vezes a pessoa tentou baixar com algo faltando. O aviso só aparece depois da primeira tentativa.
  const [blockedAttempts, setBlockedAttempts] = useState(0)
  const missingRef = useRef<HTMLDivElement>(null)
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

  // O aviso aparece abaixo do botão: garante que ele fique visível depois do clique
  useEffect(() => {
    if (blockedAttempts > 0) missingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [blockedAttempts])

  const missing = getMissingFields(content)

  async function handleDownload() {
    setDownloadError(null)
    if (missing.length > 0) {
      setBlockedAttempts((current) => current + 1)
      return
    }
    setDownloading(true)
    try {
      await downloadResumePdf(content, hasPhoto)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.')
    } finally {
      setDownloading(false)
    }
  }

  function handlePhotoChange(next: boolean) {
    setHasPhoto(next)
    setPhotoVersion((current) => current + 1)
  }

  const photoUrl = hasPhoto ? `/api/resume/photo?v=${photoVersion}` : null

  const title = (
    <div className="mb-6">
      <h1 className="text-3xl font-semibold">Currículo</h1>
      <p className="mt-1 text-sm text-white/60">
        Preencha aos poucos: tudo fica salvo, e a prévia mostra como o currículo vai sair.
      </p>
    </div>
  )

  return (
    <div>
      {load.status === 'loading' && (
        <>
          {title}
          <p className="py-16 text-center text-white/50">Carregando currículo...</p>
        </>
      )}

      {load.status === 'error' && (
        <>
          {title}
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
        </>
      )}

      {load.status === 'ready' && (
        // Título, campos e botão ficam à esquerda; a prévia, fixa à direita, começa no topo da página
        // para aproveitar toda a altura da tela. A largura dela vem do próprio tamanho da folha (auto).
        // Em telas estreitas fica tudo empilhado: formulário, prévia e, por último, o botão de baixar.
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            {title}
            <ResumeForm content={content} onChange={handleChange} photoUrl={photoUrl} onPhotoChange={handlePhotoChange} />
          </div>

          {/* 7rem = altura do header + espaçamento da página: é o que sobra de tela para a prévia */}
          <aside className="lg:sticky lg:top-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-mono text-xs tracking-wider text-white/70 uppercase">
                <span className="text-brand">•</span> Prévia
              </p>
              <span className="flex items-center gap-2 text-xs">
                <span className={saveStatus === 'error' ? 'text-rose-400' : 'text-white/40'}>{SAVE_LABEL[saveStatus]}</span>
                {saveStatus === 'error' && (
                  <button type="button" onClick={flush} className="font-medium text-brand hover:text-white">
                    Tentar de novo
                  </button>
                )}
              </span>
            </div>
            <ResumePreview content={content} photoUrl={photoUrl} />
          </aside>

          <div ref={missingRef} className="min-w-0 lg:col-start-1">
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {downloading ? 'Gerando...' : 'Baixar currículo'}
            </button>
            {downloadError && <p className="mt-2 text-center text-sm text-rose-400">{downloadError}</p>}

            {/* A lista acompanha o preenchimento: cada campo some dela assim que é resolvido */}
            {blockedAttempts > 0 && missing.length > 0 && (
              <div role="alert" className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
                <p className="text-sm font-semibold text-rose-300">Para baixar, falta preencher:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {missing.map((field) => (
                    <li key={field.label}>
                      <button
                        type="button"
                        onClick={() => scrollToSection(field.section)}
                        className="text-left text-white/85 underline-offset-2 transition hover:text-white hover:underline"
                      >
                        {field.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
