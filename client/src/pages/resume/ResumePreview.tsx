import { useDeferredValue, useMemo } from 'react'
import type { ResumeContent } from '../../lib/resume'
import {
  COLOR_MUTED,
  COLOR_TEXT,
  layoutResume,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  POINT_TO_MM,
  RULE_COLOR,
  RULE_WIDTH,
  type ResumeOp,
} from '../../lib/resumeLayout'

// Arial tem as mesmas medidas da Helvetica usada no PDF, então a prévia quebra as linhas igual
const PREVIEW_FONT = 'Helvetica, Arial, sans-serif'

type ResumePreviewProps = {
  content: ResumeContent
  photoUrl: string | null // null = sem foto: não desenha nada no lugar dela
}

function PreviewOp({ op, photoUrl }: { op: ResumeOp; photoUrl: string | null }) {
  if (op.type === 'line') {
    return <line x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} stroke={RULE_COLOR} strokeWidth={RULE_WIDTH} />
  }
  if (op.type === 'photo') {
    return photoUrl ? (
      <image
        href={photoUrl}
        x={op.x}
        y={op.y}
        width={op.size}
        height={op.size}
        preserveAspectRatio="xMidYMid slice"
      />
    ) : null
  }
  return (
    <text
      x={op.x}
      y={op.y}
      fontFamily={PREVIEW_FONT}
      fontSize={op.size * POINT_TO_MM}
      fontWeight={op.bold ? 700 : 400}
      fill={op.muted ? COLOR_MUTED : COLOR_TEXT}
      textAnchor={op.alignRight ? 'end' : 'start'}
      textRendering="geometricPrecision"
    >
      {op.text}
    </text>
  )
}

// Mostra o currículo como ele vai sair no PDF, atualizando enquanto a pessoa digita
export function ResumePreview({ content, photoUrl }: ResumePreviewProps) {
  // Deferred: se o cálculo demorar, a digitação tem prioridade e a prévia alcança logo depois
  const deferredContent = useDeferredValue(content)
  const pages = useMemo(() => layoutResume(deferredContent, photoUrl !== null), [deferredContent, photoUrl])
  const isEmpty = pages.length === 1 && pages[0].length === 0

  return (
    // A largura sai da altura da tela, para a folha inteira caber sem rolar: 8.75rem é o que o header, o
    // espaçamento e o rótulo "Prévia" ocupam, e 1.4143 é a proporção do A4 (297 / 210).
    // Em telas largas, 100vw-43.5rem garante ao menos 24rem para o formulário ao lado da sidebar.
    <div className="mx-auto w-[min(100%,calc((100vh-8.75rem)/1.4143))] space-y-3 lg:w-[min(calc((100vh-8.75rem)/1.4143),calc(100vw-43.5rem))]">
      {pages.map((ops, index) => (
        <div key={index} className="relative overflow-hidden rounded-sm bg-white">
          <svg
            viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
            role="img"
            aria-label={`Prévia do currículo, página ${index + 1}`}
            className="block h-auto w-full"
          >
            {ops.map((op, opIndex) => (
              <PreviewOp key={opIndex} op={op} photoUrl={photoUrl} />
            ))}
          </svg>
          {isEmpty && (
            <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-ink/40">
              Comece a preencher e seu currículo aparece aqui.
            </p>
          )}
        </div>
      ))}

      {pages.length > 1 && (
        <p className="text-sm text-amber-300">
          O currículo está com {pages.length} páginas. Para uma vaga de início de carreira, o ideal é 1: tente deixar o
          texto mais curto.
        </p>
      )}
    </div>
  )
}
