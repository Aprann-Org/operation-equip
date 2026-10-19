'use client'

type Props = {
  /** Fully escaped CSV text, built on the server alongside the tables. */
  csv: string
  filename: string
}

export function ReportActions({ csv, filename }: Props) {
  function download() {
    // Leading BOM so Excel opens the file as UTF-8 rather than mangling accents
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="no-print" style={{ display: 'flex', gap: 8 }}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
        Print
      </button>
      <button type="button" className="btn btn-primary btn-sm" onClick={download}>
        Download CSV
      </button>
    </div>
  )
}
