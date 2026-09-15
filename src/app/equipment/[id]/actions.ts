'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUserContext } from '@/lib/auth'
import { DISK_TYPES, HARDWARE_FIELD_LABELS, type EquipmentStage } from '@/lib/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Bounds mirror the intake form's own input constraints. */
const MAX_SPEC_TEXT = 200
const MAX_REASON = 1000

export async function changeStage(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const equipmentId = formData.get('equipment_id') as string
  const newStage = formData.get('new_stage') as EquipmentStage
  const reason = (formData.get('reason') as string) || null

  const { data: equip } = await supabase
    .from('equipment')
    .select('stage, organization_id, date_received, date_sent')
    .eq('id', equipmentId)
    .single()

  if (!equip) return { error: 'Equipment not found' }

  const updateData: Record<string, unknown> = { stage: newStage, sub_status: null }
  // Stage milestones only *fill in* a missing date — re-entering a stage must not
  // clobber a date that was already recorded (or corrected by hand).
  const today = new Date().toISOString().split('T')[0]
  if (newStage === 'received' && !equip.date_received) updateData.date_received = today
  if (newStage === 'distributed' && !equip.date_sent) updateData.date_sent = today
  if (newStage === 'retired') {
    const retirementReason = (formData.get('retirement_reason') as string) || null
    if (!retirementReason) return { error: 'Retirement reason is required' }
    updateData.retirement_reason = retirementReason
    updateData.retirement_notes = (formData.get('retirement_notes') as string) || null
  }

  // .select() lets us detect if RLS blocked the update (returns empty array)
  const { data: updated, error: updateError } = await supabase
    .from('equipment')
    .update(updateData)
    .eq('id', equipmentId)
    .select('id')

  if (updateError) return { error: updateError.message }
  if (!updated?.length) return { error: 'Permission denied' }

  await supabase.from('stage_history').insert({
    organization_id: equip.organization_id,
    equipment_id: equipmentId,
    from_stage: equip.stage,
    to_stage: newStage,
    user_id: user.id,
    reason,
  })

  revalidatePath(`/equipment/${equipmentId}`)
  revalidatePath('/equipment')
  revalidatePath('/my-work')
  revalidatePath('/')
  return {}
}

export async function changeSubStatus(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const equipmentId = formData.get('equipment_id') as string
  const subStatus = (formData.get('sub_status') as string) || null

  const { data: updated, error } = await supabase
    .from('equipment')
    .update({ sub_status: subStatus })
    .eq('id', equipmentId)
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'Permission denied' }

  revalidatePath(`/equipment/${equipmentId}`)
  revalidatePath('/my-work')
  return {}
}

/**
 * Edits a device's hardware specs after intake — the RAM that turned out to be
 * 16 GB, the disk swapped during refurb, the processor mistyped at the bench.
 *
 * Unlike the batch editor on /equipment, every input is submitted every time,
 * so this form is read as "what you see is what gets saved": a blank field
 * clears the value rather than leaving it alone. Each field that actually
 * changed is written to equipment_spec_history.
 */
export async function updateHardware(
  _prevState: { error: string | null; message: string | null },
  formData: FormData
): Promise<{ error: string | null; message: string | null }> {
  const ctx = await getCurrentUserContext()
  if (!ctx) return { error: 'Not authenticated', message: null }
  // Server Actions are reachable by direct POST, so the role is re-checked here
  // rather than relying on the UI having hidden the form.
  if (!ctx.canManageEquipment) {
    return { error: 'You do not have permission to edit hardware specs', message: null }
  }

  const equipmentId = formData.get('equipment_id')
  if (typeof equipmentId !== 'string' || !UUID_RE.test(equipmentId)) {
    return { error: 'Invalid equipment id', message: null }
  }

  const invalid: string[] = []

  function text(name: string): string | null {
    const raw = formData.get(name)
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    if (!trimmed) return null
    if (trimmed.length > MAX_SPEC_TEXT) {
      invalid.push(name)
      return null
    }
    return trimmed
  }

  function integer(name: string, min: number, max: number): number | null {
    const raw = formData.get(name)
    if (typeof raw !== 'string' || !raw.trim()) return null
    const n = Number(raw)
    if (!Number.isInteger(n) || n < min || n > max) {
      invalid.push(name)
      return null
    }
    return n
  }

  function decimal(name: string, min: number, max: number): number | null {
    const raw = formData.get(name)
    if (typeof raw !== 'string' || !raw.trim()) return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n < min || n > max) {
      invalid.push(name)
      return null
    }
    // The form offers one decimal place (step="0.1"); don't store more.
    return Math.round(n * 10) / 10
  }

  function choice<T extends string>(name: string, allowed: readonly T[]): T | null {
    const raw = formData.get(name)
    if (typeof raw !== 'string' || !raw) return null
    if (!(allowed as readonly string[]).includes(raw)) {
      invalid.push(name)
      return null
    }
    return raw as T
  }

  // Promoted columns.
  const nextColumns: Record<string, string | number | null> = {
    make: text('make'),
    model: text('model'),
    processor: text('processor'),
    ram_gb: integer('ram_gb', 1, 512),
    disk_capacity_gb: integer('disk_capacity_gb', 1, 1_048_576),
  }

  // Laptop keys inside the specs JSONB.
  const nextSpecs: Record<string, string | number | null> = {
    disk_type: choice('disk_type', DISK_TYPES),
    screen_size_in: decimal('screen_size_in', 1, 120),
    os: text('os'),
  }

  if (invalid.length) {
    const labels = invalid.map(
      (n) => HARDWARE_FIELD_LABELS[n] ?? HARDWARE_FIELD_LABELS[`specs.${n}`] ?? n
    )
    return { error: `Invalid value for: ${labels.join(', ')}`, message: null }
  }

  const supabase = await createClient()

  // The previous values are needed for the diff, and the org id for the
  // history rows — both are gone once the update lands.
  const { data: before } = await supabase
    .from('equipment')
    .select('organization_id, make, model, processor, ram_gb, disk_capacity_gb, specs')
    .eq('id', equipmentId)
    .single()

  if (!before) return { error: 'Equipment not found', message: null }

  const changes: Array<{ field: string; from: unknown; to: unknown }> = []
  const patch: Record<string, unknown> = {}

  for (const [column, value] of Object.entries(nextColumns)) {
    const current = (before as Record<string, unknown>)[column] ?? null
    if (current === value) continue
    patch[column] = value
    changes.push({ field: column, from: current, to: value })
  }

  /**
   * specs also holds keys this form does not manage — windows_key, office_key,
   * bios_version, bios_date — so the JSONB is merged, never replaced.
   */
  const currentSpecs = (before.specs ?? {}) as Record<string, unknown>
  const mergedSpecs: Record<string, unknown> = { ...currentSpecs }
  let specsChanged = false

  for (const [key, value] of Object.entries(nextSpecs)) {
    const current = currentSpecs[key] ?? null
    if (current === value) continue
    if (value === null) delete mergedSpecs[key]
    else mergedSpecs[key] = value
    specsChanged = true
    changes.push({ field: `specs.${key}`, from: current, to: value })
  }

  if (specsChanged) {
    patch.specs = Object.keys(mergedSpecs).length ? mergedSpecs : null
  }

  if (!changes.length) return { error: null, message: 'No changes to save.' }

  // .select() lets us detect if RLS blocked the update (returns empty array)
  const { data: updated, error: updateError } = await supabase
    .from('equipment')
    .update(patch)
    .eq('id', equipmentId)
    .select('id')

  if (updateError) return { error: updateError.message, message: null }
  if (!updated?.length) return { error: 'Permission denied', message: null }

  const reason = ((formData.get('reason') as string) ?? '').trim().slice(0, MAX_REASON) || null

  const { error: historyError } = await supabase.from('equipment_spec_history').insert(
    changes.map((c) => ({
      organization_id: before.organization_id,
      equipment_id: equipmentId,
      field: c.field,
      from_value: c.from == null ? null : String(c.from),
      to_value: c.to == null ? null : String(c.to),
      user_id: ctx.userId,
      reason,
    }))
  )

  revalidatePath(`/equipment/${equipmentId}`)
  revalidatePath('/equipment')
  revalidatePath('/my-equipment')
  revalidatePath('/my-work')

  const count = changes.length
  return {
    error: null,
    message:
      `Saved ${count} change${count !== 1 ? 's' : ''}.` +
      (historyError ? ` Change history could not be recorded: ${historyError.message}` : ''),
  }
}

export async function addNote(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const equipmentId = formData.get('equipment_id') as string
  const note = (formData.get('note') as string).trim()
  if (!note) return { error: 'Note cannot be empty' }
  if (note.length > 10000) return { error: 'Note is too long (max 10,000 characters)' }

  const { data: equip } = await supabase
    .from('equipment')
    .select('organization_id')
    .eq('id', equipmentId)
    .single()

  if (!equip) return { error: 'Equipment not found' }

  const { error } = await supabase.from('equipment_notes').insert({
    organization_id: equip.organization_id,
    equipment_id: equipmentId,
    user_id: user.id,
    note,
    visibility: (formData.get('visibility') as string) ?? 'internal',
  })

  if (error) return { error: error.message }

  revalidatePath(`/equipment/${equipmentId}`)
  return {}
}

export async function saveChecklistResult(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const equipmentId = formData.get('equipment_id') as string
  const itemId = formData.get('checklist_item_id') as string
  const resultType = formData.get('result_type') as string

  const { data: equip } = await supabase
    .from('equipment')
    .select('organization_id')
    .eq('id', equipmentId)
    .single()

  if (!equip) return { error: 'Equipment not found' }

  const payload: Record<string, unknown> = {
    organization_id: equip.organization_id,
    equipment_id: equipmentId,
    checklist_item_id: itemId,
    technician_id: user.id,
    completed_at: new Date().toISOString(),
  }

  if (resultType === 'boolean') {
    payload.result_boolean = formData.get('result_boolean') === 'true'
  } else if (resultType === 'numeric') {
    payload.result_numeric = parseFloat(formData.get('result_numeric') as string)
  } else {
    const text = formData.get('result_text') as string
    if (text.length > 5000) return { error: 'Result text is too long' }
    payload.result_text = text
  }

  const { error } = await supabase
    .from('checklist_results')
    .upsert(payload, { onConflict: 'equipment_id,checklist_item_id' })

  if (error) return { error: error.message }

  revalidatePath(`/equipment/${equipmentId}`)
  revalidatePath('/my-work')
  return {}
}

export async function updateDestination(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const equipmentId = formData.get('equipment_id') as string

  const { data: updated, error } = await supabase
    .from('equipment')
    .update({
      destination_organization_id: (formData.get('destination_organization_id') as string) || null,
      destination_person_id: (formData.get('destination_person_id') as string) || null,
      tech_due_date: (formData.get('tech_due_date') as string) || null,
    })
    .eq('id', equipmentId)
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'Permission denied' }

  revalidatePath(`/equipment/${equipmentId}`)
  revalidatePath('/my-work')
  return {}
}

export async function assignTechnician(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const equipmentId = formData.get('equipment_id') as string
  const technicianId = (formData.get('technician_id') as string) || null
  const techDueDate = (formData.get('tech_due_date') as string) || null

  await supabase
    .from('equipment')
    .update({ assigned_technician_id: technicianId, tech_due_date: techDueDate })
    .eq('id', equipmentId)
    .select('id')

  revalidatePath(`/equipment/${equipmentId}`)
  revalidatePath('/my-work')
}

export async function createBatteryReport(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const equipmentId = formData.get('equipment_id') as string
  const reportDate = formData.get('report_date') as string
  if (!reportDate) return { error: 'Report date is required' }

  const { data: equip } = await supabase
    .from('equipment')
    .select('organization_id')
    .eq('id', equipmentId)
    .single()

  if (!equip) return { error: 'Equipment not found' }

  const num = (key: string) => {
    const v = formData.get(key) as string
    return v ? parseInt(v, 10) : null
  }

  const { error } = await supabase.from('battery_reports').insert({
    organization_id: equip.organization_id,
    equipment_id: equipmentId,
    report_date: reportDate,
    design_capacity_mwh: num('design_capacity_mwh'),
    full_charge_capacity_mwh: num('full_charge_capacity_mwh'),
    cycle_count: num('cycle_count'),
    estimated_runtime_minutes: num('estimated_runtime_minutes'),
    source: formData.get('source') as string,
    raw_report_url: (formData.get('raw_report_url') as string) || null,
    created_by_user_id: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/equipment/${equipmentId}`)
  return { error: null }
}
