/**
 * Shared vocabulary for the technician work queue. Imported by both the server
 * page and the client-side row actions, so it must stay free of server-only
 * imports.
 */

import type { EquipmentStage, EquipmentSubStatus } from '@/lib/types'

/** Stages where a device is still someone's responsibility to move along. */
export const ACTIVE_STAGES: EquipmentStage[] = [
  'acquired',
  'received',
  'in_process',
  'ready_for_distribution',
  'in_support',
]

export type WorkView = 'active' | 'overdue' | 'in_process' | 'blocked' | 'done'

export const WORK_VIEWS: { key: WorkView; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'in_process', label: 'In Process' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Completed' },
]

export function isWorkView(value: string | undefined): value is WorkView {
  return !!value && WORK_VIEWS.some((v) => v.key === value)
}

export type WorkItem = {
  id: string
  internalId: string
  deviceName: string
  typeName: string | null
  stage: EquipmentStage
  subStatus: EquipmentSubStatus | null
  condition: string | null
  dueDate: string | null
  /** Whole days from today to `dueDate`; negative when overdue, null when unset. */
  daysUntilDue: number | null
  destName: string | null
  openThreads: number
  checklistDone: number
  checklistTotal: number
}

/**
 * Whole days from today to a Postgres `date`. Both sides are pinned to local
 * midnight — parsing "2026-08-06" with `new Date()` would treat it as UTC and
 * land on the previous day west of GMT.
 */
export function daysUntil(date: string | null): number | null {
  if (!date) return null
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const now = new Date()
  const due = new Date(y, m - 1, d).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((due - today) / 86_400_000)
}

export type DueTone = 'overdue' | 'soon' | 'later' | 'none'

/** Human phrasing plus the urgency tone the row is coloured by. */
export function describeDue(days: number | null): { label: string; tone: DueTone } {
  if (days === null) return { label: 'No due date', tone: 'none' }
  if (days < 0) {
    const n = Math.abs(days)
    return { label: `Overdue by ${n} day${n !== 1 ? 's' : ''}`, tone: 'overdue' }
  }
  if (days === 0) return { label: 'Due today', tone: 'overdue' }
  if (days === 1) return { label: 'Due tomorrow', tone: 'soon' }
  if (days <= 7) return { label: `Due in ${days} days`, tone: 'soon' }
  return { label: `Due in ${days} days`, tone: 'later' }
}

/**
 * Most urgent first: soonest due date wins, undated work sinks to the bottom,
 * and `internal_id` keeps the order stable across renders.
 */
export function byUrgency(a: WorkItem, b: WorkItem): number {
  const ad = a.daysUntilDue ?? Number.POSITIVE_INFINITY
  const bd = b.daysUntilDue ?? Number.POSITIVE_INFINITY
  if (ad !== bd) return ad - bd
  return a.internalId.localeCompare(b.internalId)
}

export function matchesView(item: WorkItem, view: WorkView): boolean {
  switch (view) {
    case 'overdue':
      return item.daysUntilDue !== null && item.daysUntilDue <= 0 && isActive(item)
    case 'in_process':
      return item.stage === 'in_process'
    case 'blocked':
      return item.subStatus === 'blocked'
    case 'done':
      return !isActive(item)
    case 'active':
      return isActive(item)
  }
}

function isActive(item: WorkItem): boolean {
  return ACTIVE_STAGES.includes(item.stage)
}
