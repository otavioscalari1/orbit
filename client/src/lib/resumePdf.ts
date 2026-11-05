import { jsPDF } from 'jspdf'
import type { ResumeContent } from './resume'
import { cleanText, COLOR_MUTED, COLOR_TEXT, layoutResume, RULE_COLOR, RULE_WIDTH } from './resumeLayout'

// O texto é escrito direto no PDF (não como imagem): dá para selecionar, e os sistemas
// que as empresas usam para ler currículos conseguem entender.
export function buildResumePdf(content: ResumeContent, photo: Uint8Array | null) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  layoutResume(content, photo !== null).forEach((ops, index) => {
    if (index > 0) pdf.addPage('a4', 'portrait')
    for (const op of ops) {
      if (op.type === 'text') {
        pdf.setFont('helvetica', op.bold ? 'bold' : 'normal')
        pdf.setFontSize(op.size)
        pdf.setTextColor(op.muted ? COLOR_MUTED : COLOR_TEXT)
        pdf.text(op.text, op.x, op.y, { align: op.alignRight ? 'right' : 'left' })
      } else if (op.type === 'line') {
        pdf.setDrawColor(RULE_COLOR)
        pdf.setLineWidth(RULE_WIDTH)
        pdf.line(op.x1, op.y1, op.x2, op.y2)
      } else if (photo) {
        pdf.addImage(photo, 'JPEG', op.x, op.y, op.size, op.size)
      }
    }
  })

  pdf.setProperties({ title: `Currículo - ${cleanText(content.contact.fullName)}` })
  return pdf
}

// Gera o PDF e baixa no navegador
export async function downloadResumePdf(content: ResumeContent, hasPhoto: boolean) {
  let photo: Uint8Array | null = null
  if (hasPhoto) {
    const response = await fetch('/api/resume/photo')
    if (!response.ok) throw new Error('Não foi possível carregar a foto.')
    photo = new Uint8Array(await response.arrayBuffer())
  }

  const pdf = buildResumePdf(content, photo)
  // Nome do arquivo sem caracteres que o sistema não aceita
  const name = content.contact.fullName.replace(/[\\/:*?"<>|]+/g, '').trim()
  pdf.save(`Currículo - ${name}.pdf`)
}
