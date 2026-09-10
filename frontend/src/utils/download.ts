const CSV_MIME = 'text/csv;charset=utf-8'
const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf])

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** 用产品/运行样例扩到演示下载所需的 20~50 行。 */
export function expandDemoRows(
  columns: string[],
  sample: string[][],
  count = 28,
): Record<string, unknown>[] {
  const size = Math.min(50, Math.max(20, count))
  const source = sample.length > 0 ? sample : [columns.map((column) => column)]
  return Array.from({ length: size }, (_, index) => {
    const cells = source[index % source.length] ?? []
    const row: Record<string, unknown> = {}
    columns.forEach((column, columnIndex) => {
      const base = cells[columnIndex] ?? column
      row[column] = index < source.length ? base : `${base}-${String(index + 1).padStart(2, '0')}`
    })
    return row
  })
}

export function mockResultFile(title: string, rows: Record<string, unknown>[]): Blob {
  const columns = rows[0] ? Object.keys(rows[0]) : ['title']
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ]
  if (rows.length === 0) lines.push(csvCell(title))
  return new Blob([UTF8_BOM, lines.join('\n')], { type: CSV_MIME })
}

export function downloadBlob(filename: string, mime: string, content: string | Blob): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function csvFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '') + '.csv'
}
