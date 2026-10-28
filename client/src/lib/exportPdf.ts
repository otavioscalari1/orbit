import { jsPDF } from 'jspdf'
import { drawPage, PAGE_HEIGHT, PAGE_WIDTH, type NoteDetail } from './board'

// Resolução de cada folha no PDF (~150 dpi em A4): boa para imprimir sem deixar o arquivo enorme
const EXPORT_WIDTH = 1240
const EXPORT_HEIGHT = Math.round((EXPORT_WIDTH * PAGE_HEIGHT) / PAGE_WIDTH)

// Gera um PDF A4 com todas as folhas da anotação e baixa no navegador
export function exportNoteToPdf(note: NoteDetail) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const canvas = document.createElement('canvas')
  canvas.width = EXPORT_WIDTH
  canvas.height = EXPORT_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível gerar o PDF neste navegador.')

  note.pages.forEach((page, index) => {
    drawPage(ctx, EXPORT_WIDTH, EXPORT_HEIGHT, note.paperTheme, page.strokes)
    if (index > 0) pdf.addPage('a4', 'portrait')
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297)
  })

  // Nome do arquivo = título da anotação, sem caracteres que o sistema não aceita
  const fileName = note.title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'anotacao'
  pdf.save(`${fileName}.pdf`)
}
