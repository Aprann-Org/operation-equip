/**
 * Pure logic for the intake autofill API (/api/intake/autofill): validating
 * what the PowerShell script reports, checking the hardware identity, and
 * working out which fields to fill. No database access lives here, so the
 * route stays a thin shell around these functions.
 */

import { DISK_TYPES, type DiskType } from '@/lib/types'

/** Bounds mirror updateHardware so autofilled values pass the same checks as hand edits. */
const MAX_TEXT = 200
const MAX_ID = 100

export type ReportedBattery = {
  design_capacity_mwh: number | null
  full_charge_capacity_mwh: number | null
  cycle_count: number | null
  estimated_runtime_minutes: number | null
}

export type ReportedHardware = {
  make: string | null
  model: string | null
  processor: string | null
  ram_gb: number | null
  disk_capacity_gb: number | null
  disk_type: DiskType | null
  screen_size_in: number | null
  os: string | null
  bios_version: string | null
  bios_date: string | null
}

export type IntakePayload = {
  internal_id: string
  serial_number: string | null
  hardware_uuid: string | null
  hardware: ReportedHardware
  battery: ReportedBattery | null
  overwrite: boolean
  dry_run: boolean
}

export type ParseResult =
  | { ok: true; value: IntakePayload; warnings: string[] }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Identity normalization
// ---------------------------------------------------------------------------

/**
 * Values OEMs leave in the BIOS serial field when they never set one. Treating
 * these as real would link every such laptop to the first one scanned.
 */
const PLACEHOLDER_SERIALS = new Set([
  'TO BE FILLED BY O.E.M.',
  'TO BE FILLED BY OEM',
  'DEFAULT STRING',
  'SYSTEM SERIAL NUMBER',
  'CHASSIS SERIAL NUMBER',
  'NOT APPLICABLE',
  'NOT SPECIFIED',
  'INVALID',
  'NONE',
  'N/A',
  'NA',
  'OEM',
  'SERIAL',
  '123456789',
  '0123456789',
])

const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/

/** A well-known UUID shipped on many unbranded boards, plus the all-0 / all-F forms. */
const PLACEHOLDER_UUIDS = new Set([
  '00000000-0000-0000-0000-000000000000',
  'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
  '03000200-0400-0500-0006-000700080009',
])

/** Uppercased and whitespace-collapsed, or null for missing / placeholder serials. */
export function normalizeSerial(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().replace(/\s+/g, ' ').toUpperCase()
  if (!s || s.length > MAX_ID) return null
  if (PLACEHOLDER_SERIALS.has(s)) return null
  // "0000000", "XXXXXXX", "......." — one character repeated is never a real serial.
  if (/^(.)\1*$/.test(s)) return null
  return s
}

/** Uppercased canonical UUID, or null for missing / malformed / placeholder values. */
export function normalizeHardwareUuid(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().replace(/^\{|\}$/g, '').toUpperCase()
  if (!UUID_RE.test(s) || PLACEHOLDER_UUIDS.has(s)) return null
  return s
}

// ---------------------------------------------------------------------------
// Payload parsing
// ---------------------------------------------------------------------------

/**
 * Validates the script's JSON body. Only internal_id is required. An optional
 * field that fails validation is dropped with a warning rather than failing the
 * whole request — one odd WMI reading should not stop the rest from filling in.
 */
export function parseIntakePayload(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Request body must be a JSON object' }
  }
  const body = raw as Record<string, unknown>
  const warnings: string[] = []

  const internalId = typeof body.internal_id === 'string' ? body.internal_id.trim() : ''
  if (!internalId) return { ok: false, error: 'internal_id (the laptop number) is required' }
  if (internalId.length > MAX_ID) return { ok: false, error: 'internal_id is too long' }

  function text(obj: Record<string, unknown>, name: string): string | null {
    const v = obj[name]
    if (v == null || v === '') return null
    if (typeof v !== 'string') {
      warnings.push(`${name}: expected text, ignored`)
      return null
    }
    const t = v.trim().replace(/\s+/g, ' ')
    if (!t) return null
    if (t.length > MAX_TEXT) {
      warnings.push(`${name}: longer than ${MAX_TEXT} characters, ignored`)
      return null
    }
    return t
  }

  function integer(obj: Record<string, unknown>, name: string, min: number, max: number): number | null {
    const v = obj[name]
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isInteger(n) || n < min || n > max) {
      warnings.push(`${name}: ${JSON.stringify(v)} is out of range, ignored`)
      return null
    }
    return n
  }

  function decimal(obj: Record<string, unknown>, name: string, min: number, max: number): number | null {
    const v = obj[name]
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n) || n < min || n > max) {
      warnings.push(`${name}: ${JSON.stringify(v)} is out of range, ignored`)
      return null
    }
    return Math.round(n * 10) / 10
  }

  const diskTypeRaw = typeof body.disk_type === 'string' ? body.disk_type.trim().toLowerCase() : null
  let diskType: DiskType | null = null
  if (diskTypeRaw) {
    if ((DISK_TYPES as readonly string[]).includes(diskTypeRaw)) diskType = diskTypeRaw as DiskType
    else warnings.push(`disk_type: "${diskTypeRaw}" is not one of ${DISK_TYPES.join(', ')}, ignored`)
  }

  let biosDate = text(body, 'bios_date')
  if (biosDate && !/^\d{4}-\d{2}-\d{2}$/.test(biosDate)) {
    warnings.push('bios_date: expected YYYY-MM-DD, ignored')
    biosDate = null
  }

  const hardware: ReportedHardware = {
    make: text(body, 'make'),
    model: text(body, 'model'),
    processor: text(body, 'processor'),
    ram_gb: integer(body, 'ram_gb', 1, 512),
    disk_capacity_gb: integer(body, 'disk_capacity_gb', 1, 1_048_576),
    disk_type: diskType,
    screen_size_in: decimal(body, 'screen_size_in', 1, 120),
    os: text(body, 'os'),
    bios_version: text(body, 'bios_version'),
    bios_date: biosDate,
  }

  let battery: ReportedBattery | null = null
  if (body.battery != null) {
    if (typeof body.battery !== 'object' || Array.isArray(body.battery)) {
      warnings.push('battery: expected an object, ignored')
    } else {
      const b = body.battery as Record<string, unknown>
      const candidate: ReportedBattery = {
        design_capacity_mwh: integer(b, 'design_capacity_mwh', 1, 1_000_000),
        full_charge_capacity_mwh: integer(b, 'full_charge_capacity_mwh', 0, 1_000_000),
        cycle_count: integer(b, 'cycle_count', 0, 100_000),
        estimated_runtime_minutes: integer(b, 'estimated_runtime_minutes', 0, 10_000),
      }
      // A report with no capacity reading says nothing about battery health.
      if (candidate.design_capacity_mwh != null || candidate.full_charge_capacity_mwh != null) {
        battery = candidate
      }
    }
  }

  return {
    ok: true,
    warnings,
    value: {
      internal_id: internalId,
      serial_number: normalizeSerial(body.serial_number),
      hardware_uuid: normalizeHardwareUuid(body.hardware_uuid),
      hardware,
      battery,
      overwrite: body.overwrite === true,
      dry_run: body.dry_run === true,
    },
  }
}

// ---------------------------------------------------------------------------
// Identity check
// ---------------------------------------------------------------------------

export type IdentityCheck =
  | { ok: true; link: { serial_number?: string; hardware_uuid?: string } }
  | { ok: false; error: string }

/**
 * The device's stored identity must agree with what the laptop reports. A blank
 * stored value is linked on this scan; a different stored value means the
 * laptop number was mistyped (or the board was swapped, which an admin fixes
 * by hand). Never overridable by `overwrite`.
 */
export function checkIdentity(
  stored: { internal_id: string; serial_number: string | null; hardware_uuid: string | null },
  reported: { serial_number: string | null; hardware_uuid: string | null }
): IdentityCheck {
  const link: { serial_number?: string; hardware_uuid?: string } = {}

  if (reported.serial_number) {
    if (stored.serial_number && stored.serial_number !== reported.serial_number) {
      return {
        ok: false,
        error:
          `Laptop #${stored.internal_id} is registered to serial ${stored.serial_number}, ` +
          `but this laptop's serial is ${reported.serial_number}. Check the laptop number. ` +
          `If the motherboard was replaced, an admin can update the serial on the device page.`,
      }
    }
    if (!stored.serial_number) link.serial_number = reported.serial_number
  }

  if (reported.hardware_uuid) {
    if (stored.hardware_uuid && stored.hardware_uuid !== reported.hardware_uuid) {
      return {
        ok: false,
        error:
          `Laptop #${stored.internal_id} is registered to hardware UUID ${stored.hardware_uuid}, ` +
          `but this laptop reports ${reported.hardware_uuid}. Check the laptop number. ` +
          `If the motherboard was replaced, an admin can update the UUID on the device page.`,
      }
    }
    if (!stored.hardware_uuid) link.hardware_uuid = reported.hardware_uuid
  }

  return { ok: true, link }
}

// ---------------------------------------------------------------------------
// Fill plan
// ---------------------------------------------------------------------------

export type StoredHardware = {
  make: string | null
  model: string | null
  processor: string | null
  ram_gb: number | null
  disk_capacity_gb: number | null
  specs: Record<string, unknown> | null
}

export type FieldChange = { field: string; from: unknown; to: unknown }
export type FieldConflict = { field: string; current: unknown; reported: unknown }

export type FillPlan = {
  /** Column → value to write. `specs` is the full merged JSONB when present. */
  patch: Record<string, unknown>
  /** Every field that will change, in equipment_spec_history's field naming. */
  changes: FieldChange[]
  /** Fields left alone because they already hold a different value (only without overwrite). */
  conflicts: FieldConflict[]
}

const COLUMN_FIELDS = ['make', 'model', 'processor', 'ram_gb', 'disk_capacity_gb'] as const
const SPEC_FIELDS = ['disk_type', 'screen_size_in', 'os', 'bios_version', 'bios_date'] as const

/** Text compares case- and whitespace-insensitively, so "DELL" over "Dell" is not a conflict. */
function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase()
  }
  return a === b
}

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === 'string' && v.trim() === '')
}

/**
 * Decides what to write. A blank stored field is filled; a matching one is left
 * alone; a different one is a conflict, replaced only with `overwrite`. A field
 * the laptop did not report is never touched — autofill only adds information.
 */
export function planAutofill(
  stored: StoredHardware,
  reported: ReportedHardware,
  overwrite: boolean
): FillPlan {
  const patch: Record<string, unknown> = {}
  const changes: FieldChange[] = []
  const conflicts: FieldConflict[] = []

  function consider(field: string, current: unknown, next: unknown, apply: () => void) {
    if (next == null) return
    if (sameValue(current, next)) return
    if (!isBlank(current) && !overwrite) {
      conflicts.push({ field, current, reported: next })
      return
    }
    apply()
    changes.push({ field, from: isBlank(current) ? null : current, to: next })
  }

  for (const column of COLUMN_FIELDS) {
    const next = reported[column]
    consider(column, stored[column], next, () => {
      patch[column] = next
    })
  }

  // specs also holds keys autofill does not manage, so it is merged, never replaced.
  const currentSpecs = stored.specs ?? {}
  const mergedSpecs: Record<string, unknown> = { ...currentSpecs }
  let specsChanged = false
  for (const key of SPEC_FIELDS) {
    const next = reported[key]
    consider(`specs.${key}`, currentSpecs[key], next, () => {
      mergedSpecs[key] = next
      specsChanged = true
    })
  }
  if (specsChanged) patch.specs = mergedSpecs

  return { patch, changes, conflicts }
}
