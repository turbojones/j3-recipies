import { jsPDF } from 'jspdf'
import type { Recipe } from '../types'

const MARGIN = 48
const PAGE_WIDTH = 612 // US Letter points
const PAGE_HEIGHT = 792
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const LINE = 16
const TITLE_SIZE = 20
const HEADING_SIZE = 13
const BODY_SIZE = 11

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[]
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - MARGIN) {
    doc.addPage()
    return MARGIN
  }
  return y
}

export function downloadRecipePdf(recipe: Recipe) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  let y = MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TITLE_SIZE)
  const titleLines = wrapText(doc, recipe.title, CONTENT_WIDTH)
  for (const line of titleLines) {
    y = ensureSpace(doc, y, LINE + 4)
    doc.text(line, MARGIN, y)
    y += LINE + 4
  }

  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(BODY_SIZE)
  doc.setTextColor(90)
  const meta = `${recipe.cookTimeMinutes} min · ${recipe.servings} servings · ${recipe.cuisine}`
  doc.text(meta, MARGIN, y)
  doc.setTextColor(0)
  y += LINE + 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(HEADING_SIZE)
  y = ensureSpace(doc, y, LINE)
  doc.text('Ingredients', MARGIN, y)
  y += LINE + 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(BODY_SIZE)
  for (const item of recipe.ingredients) {
    const lines = wrapText(doc, `•  ${item}`, CONTENT_WIDTH)
    for (const line of lines) {
      y = ensureSpace(doc, y, LINE)
      doc.text(line, MARGIN, y)
      y += LINE
    }
  }

  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(HEADING_SIZE)
  y = ensureSpace(doc, y, LINE)
  doc.text('Steps', MARGIN, y)
  y += LINE + 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(BODY_SIZE)
  recipe.steps.forEach((step, i) => {
    const lines = wrapText(doc, `${i + 1}.  ${step}`, CONTENT_WIDTH)
    for (const line of lines) {
      y = ensureSpace(doc, y, LINE)
      doc.text(line, MARGIN, y)
      y += LINE
    }
    y += 4
  })

  const safeName = recipe.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  doc.save(`${safeName || 'recipe'}.pdf`)
}
