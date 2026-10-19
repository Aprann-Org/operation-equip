/**
 * Shared between the equipment table (which builds the report link) and the
 * report page (which parses it), so it must stay free of server-only imports.
 */

/**
 * The selection travels in the URL as comma-joined UUIDs (~37 chars each).
 * 200 keeps the request line around 7.5KB — well inside Node's header limit.
 */
export const MAX_REPORT_ROWS = 200

export function reportHref(ids: string[]): string {
  return `/equipment/report?ids=${ids.join(',')}`
}
