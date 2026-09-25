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
const BRAND_NAVY = [30, 58, 95] as const
const BRAND_NAME = 'J3 Recipes'
const FOOTER_Y = PAGE_HEIGHT - 28

async function loadImageDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[]
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - MARGIN - 24) {
    doc.addPage()
    return MARGIN + 8
  }
  return y
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...BRAND_NAVY)
    doc.setLineWidth(0.6)
    doc.line(MARGIN, FOOTER_Y - 10, PAGE_WIDTH - MARGIN, FOOTER_Y - 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...BRAND_NAVY)
    doc.text(BRAND_NAME, MARGIN, FOOTER_Y)
    doc.setTextColor(120)
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN, FOOTER_Y, {
      align: 'right',
    })
  }
  doc.setTextColor(0)
}

export async function downloadRecipePdf(recipe: Recipe) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  let y = MARGIN

  const logo = await loadImageDataUrl('/favicon-192.png')

  // Brand header
  const markSize = 36
  if (logo) {
    doc.addImage(logo, 'PNG', MARGIN, y - 6, markSize, markSize)
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...BRAND_NAVY)
  doc.text(BRAND_NAME, MARGIN + (logo ? markSize + 10 : 0), y + 16)
  doc.setTextColor(0)
  y += markSize + 14

  doc.setDrawColor(...BRAND_NAVY)
  doc.setLineWidth(1)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 18

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

  drawFooter(doc)

  const safeName = recipe.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  doc.save(`${safeName || 'recipe'}.pdf`)
}
