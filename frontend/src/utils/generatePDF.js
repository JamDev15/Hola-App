import jsPDF from 'jspdf'

const STATUS_COLORS = {
  pass:           [16,  185, 129],
  fail:           [239,  68,  68],
  warning:        [245, 158,  11],
  not_applicable: [100, 116, 139],
}
const STATUS_LABELS = { pass: 'PASS', fail: 'FAIL', warning: 'WARN', not_applicable: 'N/A' }
const GROUP_META = {
  front:   { label: 'Front Panel',        color: [99,  102, 241] },
  back:    { label: 'Back Panel',         color: [139,  92, 246] },
  claims:  { label: 'Claims Compliance',  color: [16,  185, 129] },
  quality: { label: 'Quality & Accuracy', color: [14,  165, 233] },
}

const W  = 210
const H  = 297
const L  = 15   // left margin
const R  = 195  // right margin x
const CW = R - L

export function generateCompliancePDF(result, { frontName, backName } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 0
  let pageNum = 1

  function newPage() {
    doc.addPage()
    pageNum++
    y = 15
  }

  function guard(needed) {
    if (y + needed > H - 18) newPage()
  }

  // ── Dark header ───────────────────────────────────────────────────────────
  doc.setFillColor(15, 12, 41)
  doc.rect(0, 0, W, 30, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(167, 139, 250)
  doc.text('HALO PRIVATE LABEL', L, 11)

  doc.setFontSize(15)
  doc.setTextColor(255, 255, 255)
  doc.text('Artwork Compliance Report', L, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  doc.text(dateStr, R, 22, { align: 'right' })

  y = 38

  // ── Overall result card ───────────────────────────────────────────────────
  const pass = result.overall_pass
  doc.setFillColor(pass ? 240 : 254, pass ? 253 : 242, pass ? 244 : 242)
  doc.roundedRect(L, y, CW, 26, 2, 2, 'F')

  doc.setDrawColor(pass ? 16 : 239, pass ? 185 : 68, pass ? 129 : 68)
  doc.setLineWidth(0.4)
  doc.roundedRect(L, y, CW, 26, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(pass ? 6 : 153, pass ? 95 : 27, pass ? 70 : 27)
  doc.text(pass ? '✓  ARTWORK APPROVED' : '✗  REVISIONS REQUIRED', L + 5, y + 9)

  const passCount = result.checks?.filter(c => c.status === 'pass').length    || 0
  const failCount = result.checks?.filter(c => c.status === 'fail').length    || 0
  const warnCount = result.checks?.filter(c => c.status === 'warning').length || 0

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text(
    `${passCount} passed  ·  ${failCount} failed  ·  ${warnCount} warnings  ·  Panel: ${result.panel_detected || 'unknown'}`,
    L + 5, y + 16,
  )

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(result.summary || '', CW - 10)
  doc.text(summaryLines, L + 5, y + 23)

  y += 32

  // ── Files analysed ────────────────────────────────────────────────────────
  if (frontName || backName) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    if (frontName) doc.text(`Front: ${frontName}`, L, y)
    if (backName)  doc.text(`Back: ${backName}`,   frontName ? L + 90 : L, y)
    y += 7
  }

  // ── Checks grouped ────────────────────────────────────────────────────────
  for (const [groupKey, meta] of Object.entries(GROUP_META)) {
    const checks = (result.checks || []).filter(c => c.group === groupKey)
    if (!checks.length) continue

    guard(14)

    // Group header bar
    doc.setFillColor(...meta.color)
    doc.rect(L, y, CW, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(meta.label.toUpperCase(), L + 3, y + 5.5)

    const gc = checks.reduce((a, c) => { a[c.status] = (a[c.status] || 0) + 1; return a }, {})
    const cStr = [
      gc.pass    && `${gc.pass} passed`,
      gc.fail    && `${gc.fail} failed`,
      gc.warning && `${gc.warning} warnings`,
    ].filter(Boolean).join('  ·  ')
    doc.text(cStr, R - 2, y + 5.5, { align: 'right' })

    y += 8

    for (const check of checks) {
      const findingLines = doc.splitTextToSize(check.finding || '', CW - 18)
      const recLines     = check.recommendation
        ? doc.splitTextToSize(`${check.recommendation}`, CW - 24)
        : []
      const rowH = 8 + findingLines.length * 4 + (recLines.length ? recLines.length * 4 + 5 : 0) + 3

      guard(rowH)

      // Alternating row bg
      doc.setFillColor(248, 250, 252)
      doc.rect(L, y, CW, rowH, 'F')

      // Status badge
      const sc = STATUS_COLORS[check.status] || STATUS_COLORS.not_applicable
      doc.setFillColor(...sc)
      doc.roundedRect(L + 1.5, y + 1.5, 13, 5, 1, 1, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.text(STATUS_LABELS[check.status] || 'N/A', L + 8, y + 5, { align: 'center' })

      // Check label
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text(check.label, L + 17, y + 5.5)

      y += 8

      // Finding text
      if (check.finding) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(71, 85, 105)
        doc.text(findingLines, L + 17, y + 1)
        y += findingLines.length * 4
      }

      // Recommendation box (fail / warning only)
      if (recLines.length && (check.status === 'fail' || check.status === 'warning')) {
        const recH = recLines.length * 4 + 4
        doc.setFillColor(255, 251, 235)
        doc.rect(L + 17, y, CW - 17, recH, 'F')
        doc.setTextColor(146, 64, 14)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.text('Fix:', L + 19, y + 4)
        doc.setFont('helvetica', 'normal')
        doc.text(recLines, L + 29, y + 4)
        y += recH + 1
      }

      // Row divider
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.2)
      doc.line(L, y + 2, R, y + 2)
      y += 4
    }

    y += 5
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFillColor(15, 12, 41)
    doc.rect(0, H - 12, W, 12, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('Halo Private Label — Artwork Compliance Report', L, H - 5)
    doc.text(`Page ${i} of ${totalPages}`, R, H - 5, { align: 'right' })
  }

  const slug = new Date().toISOString().slice(0, 10)
  doc.save(`halo-compliance-${slug}.pdf`)
}
