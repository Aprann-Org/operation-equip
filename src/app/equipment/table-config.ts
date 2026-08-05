/**
 * Shared sort/filter vocabulary for the equipment list. Imported by both the
 * server page (to build the query) and the client table (to build header
 * links), so it must stay free of server-only imports.
 */

export type SortKey =
  | 'internal_id'
  | 'make'
  | 'type'
  | 'stage'
  | 'condition'
  | 'donor'
  | 'dest'
  | 'date_acquired'
  | 'date_received'
  | 'date_sent'

export type SortDir = 'asc' | 'desc'

export type SortColumn = {
  key: SortKey
  label: string
  /**
   * Equipment column to order on in Postgres. `null` means the displayed value
   * comes from a joined table, so the rows are sorted in JS after the fetch.
   */
  column: string | null
  /** Direction applied on the first click — dates read best newest-first. */
  defaultDir: SortDir
}

export const SORT_COLUMNS: SortColumn[] = [
  { key: 'internal_id', label: 'ID', column: 'internal_id', defaultDir: 'asc' },
  { key: 'make', label: 'Make / Model', column: 'make', defaultDir: 'asc' },
  { key: 'type', label: 'Type', column: null, defaultDir: 'asc' },
  { key: 'stage', label: 'Stage', column: 'stage', defaultDir: 'asc' },
  { key: 'condition', label: 'Condition', column: 'cosmetic_condition', defaultDir: 'asc' },
  { key: 'donor', label: 'Donor / Source', column: null, defaultDir: 'asc' },
  { key: 'dest', label: 'Destination', column: null, defaultDir: 'asc' },
  { key: 'date_acquired', label: 'Acquired', column: 'date_acquired', defaultDir: 'desc' },
  { key: 'date_received', label: 'Received', column: 'date_received', defaultDir: 'desc' },
  { key: 'date_sent', label: 'Sent', column: 'date_sent', defaultDir: 'desc' },
]

export function isSortKey(value: string | undefined): value is SortKey {
  return !!value && SORT_COLUMNS.some((c) => c.key === value)
}

/**
 * Link for a sortable header. Clicking the active column flips direction;
 * clicking a new one starts at that column's natural direction.
 */
export function sortHref(
  baseQuery: string,
  key: SortKey,
  activeSort: SortKey | null,
  activeDir: SortDir
): string {
  const column = SORT_COLUMNS.find((c) => c.key === key)
  const nextDir: SortDir =
    activeSort === key
      ? activeDir === 'asc'
        ? 'desc'
        : 'asc'
      : (column?.defaultDir ?? 'asc')

  const params = new URLSearchParams(baseQuery)
  params.set('sort', key)
  params.set('dir', nextDir)
  return `/equipment?${params.toString()}`
}

/**
 * Formats a Postgres `date` for display. Parsing "2026-01-15" with `new Date()`
 * treats it as UTC midnight, which renders as the previous day west of GMT —
 * so the parts are split by hand instead.
 */
export function formatDate(value: string | null): string | null {
  if (!value) return null
  const [y, m, d] = value.slice(0, 10).split('-')
  if (!y || !m || !d) return value
  return `${Number(m)}/${Number(d)}/${y}`
}
