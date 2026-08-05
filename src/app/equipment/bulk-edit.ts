/**
 * Contract shared between the bulk edit UI and its server action. A `'use
 * server'` module may only export async functions, so the constants and types
 * live here instead.
 */

/**
 * Sentinel for "set this nullable column to NULL". An empty select value means
 * "leave unchanged", so clearing needs its own distinct value.
 */
export const CLEAR_VALUE = '__clear__'

/** Guard rail on a single batch — also bounds the stage_history insert. */
export const MAX_BULK_ROWS = 500

export type BulkEditState = {
  error: string | null
  message: string | null
}
