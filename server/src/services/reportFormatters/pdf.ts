import PDFDocument from 'pdfkit'

export function buildPDF(reportTitle: string, rows: any[], options?: { author?: string; subject?: string }): any {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  // The existing info object is spread, not replaced. pdfkit fills in
  // CreationDate and Creator when the document is finalised, and replacing
  // the object dropped them -- `doc.end()` then threw
  // "Cannot read properties of undefined (reading 'toISOString')" and every
  // PDF export failed.
  doc.info = {
    ...doc.info,
    Title: reportTitle,
    Author: options?.author || 'Smart MediCare',
    Subject: options?.subject || `Pharmacy Report: ${reportTitle}`
  } as any

  doc.fontSize(16).text(`Pharmacy Report — ${reportTitle}`, { align: 'center' })
  doc.moveDown()
  const header = Object.keys(rows[0] || {})
  const colWidths = header.map(() => 100)

  const drawRow = (vals: string[]) => {
    vals.forEach((v, i) => {
      doc.fontSize(10).text(v ?? '', 40 + i * (colWidths[i] || 100), doc.y, { width: (colWidths[i] || 100) - 10 })
    })
    doc.moveDown()
    if (doc.y > 760) {
      doc.addPage()
    }
  }

  // Header row
  doc.fontSize(12).text(header.join('  |  '))
  doc.moveDown()
  // Data rows
  rows.forEach((r) => drawRow(header.map((h) => String(r[h] ?? ''))))

  return doc
}