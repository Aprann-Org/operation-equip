'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserContext } from '@/lib/auth'
import {
  ALL_STAGES,
  COSMETIC_CONDITIONS,
  RETIREMENT_REASONS,
  SUB_STATUSES,
  type EquipmentStage,
} from '@/lib/types'
import { CLEAR_VALUE, MAX_BULK_ROWS, type BulkEditState } from './bulk-edit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const BULK_DATE_FIELDS = [
  'date_acquired',
  'date_received',
  'date_sent',
  'date_delivered',
  'tech_due_date',
] as const

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('user_roles')
    .select('organization_id')
    .eq('user_id', userId)
    .not('organization_id', 'is', null)
    .limit(1)
  return data?.[0]?.organization_id as string | undefined
}

export async function createEquipment(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const organization_id = await getOrgId(supabase, user.id)
  if (!organization_id) return { error: 'No organization found for your account' }

  const internal_id = (formData.get('internal_id') as string).trim()
  if (!internal_id) return { error: 'Internal ID is required' }

  const diskType = formData.get('disk_type') as string | null
  const screenSize = formData.get('screen_size_in') as string | null
  const os = formData.get('os') as string | null
  const specs: Record<string, unknown> = {}
  if (diskType) specs.disk_type = diskType
  if (screenSize) specs.screen_size_in = parseFloat(screenSize)
  if (os) specs.os = os

  const { data: equip, error } = await supabase
    .from('equipment')
    .insert({
      organization_id,
      equipment_type_id: formData.get('equipment_type_id') as string,
      internal_id,
      make: (formData.get('make') as string) || null,
      model: (formData.get('model') as string) || null,
      processor: (formData.get('processor') as string) || null,
      ram_gb: formData.get('ram_gb') ? parseInt(formData.get('ram_gb') as string) : null,
      disk_capacity_gb: formData.get('disk_capacity_gb') ? parseInt(formData.get('disk_capacity_gb') as string) : null,
      specs: Object.keys(specs).length ? specs : null,
      cosmetic_condition: (formData.get('cosmetic_condition') as string) || null,
      cosmetic_notes: (formData.get('cosmetic_notes') as string) || null,
      donor_organization_id: (formData.get('donor_organization_id') as string) || null,
      source_detail: (formData.get('source_detail') as string) || null,
      sponsor_name: (formData.get('sponsor_name') as string) || null,
      sponsor_email: (formData.get('sponsor_email') as string) || null,
      date_acquired: (formData.get('date_acquired') as string) || null,
      stage: 'acquired',
      created_by_user_id: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Record initial stage history
  await supabase.from('stage_history').insert({
    organization_id,
    equipment_id: equip.id,
    from_stage: null,
    to_stage: 'acquired',
    user_id: user.id,
  })

  redirect(`/equipment/${equip.id}`)
}

/**
 * Applies one set of field changes to many devices at once. Super admin only.
 *
 * Every field is three-state: absent/empty means "leave unchanged", the
 * CLEAR_VALUE sentinel means "set to NULL", anything else is the new value.
 */
export async function bulkUpdateEquipment(
  _prevState: BulkEditState,
  formData: FormData
): Promise<BulkEditState> {
  const ctx = await getCurrentUserContext()
  if (!ctx) return { error: 'Not authenticated', message: null }
  // Server Actions are reachable by direct POST, so the role is re-checked here
  // rather than relying on the UI having hidden the panel.
  if (!ctx.isSuperAdmin) {
    return { error: 'Only super admins can batch edit equipment', message: null }
  }

  const ids = Array.from(
    new Set(
      formData
        .getAll('ids')
        .filter((v): v is string => typeof v === 'string' && UUID_RE.test(v))
    )
  )
  if (!ids.length) return { error: 'No equipment selected', message: null }
  if (ids.length > MAX_BULK_ROWS) {
    return { error: `Select at most ${MAX_BULK_ROWS} devices at a time`, message: null }
  }

  const invalid: string[] = []

  /** `undefined` = unchanged, `null` = clear the column, otherwise the value. */
  function choice<T extends string>(name: string, allowed: readonly T[]): T | null | undefined {
    const raw = formData.get(name)
    if (typeof raw !== 'string' || raw === '') return undefined
    if (raw === CLEAR_VALUE) return null
    if (!(allowed as readonly string[]).includes(raw)) {
      invalid.push(name)
      return undefined
    }
    return raw as T
  }

  function uuid(name: string): string | null | undefined {
    const raw = formData.get(name)
    if (typeof raw !== 'string' || raw === '') return undefined
    if (raw === CLEAR_VALUE) return null
    if (!UUID_RE.test(raw)) {
      invalid.push(name)
      return undefined
    }
    return raw
  }

  function date(name: string): string | undefined {
    const raw = formData.get(name)
    if (typeof raw !== 'string' || raw === '') return undefined
    if (!DATE_RE.test(raw)) {
      invalid.push(name)
      return undefined
    }
    return raw
  }

  const stage = choice('stage', ALL_STAGES)
  if (stage === null) invalid.push('stage') // stage is NOT NULL — never clearable
  const subStatus = choice('sub_status', SUB_STATUSES)
  const condition = choice('cosmetic_condition', COSMETIC_CONDITIONS)
  const donorOrg = uuid('donor_organization_id')
  const destinationOrg = uuid('destination_organization_id')
  const technician = uuid('assigned_technician_id')

  // Free text: blank means "unchanged", so erasing needs its own checkbox.
  const sourceText = ((formData.get('source_detail') as string) ?? '').trim()
  const sourceDetail: string | null | undefined =
    formData.get('source_detail_clear') != null
      ? null
      : sourceText
        ? sourceText.slice(0, 500)
        : undefined
  const dates = BULK_DATE_FIELDS.map((f) => [f, date(f)] as const)

  if (invalid.length) {
    return { error: `Invalid value for: ${invalid.join(', ')}`, message: null }
  }

  const patch: Record<string, unknown> = {}
  if (subStatus !== undefined) patch.sub_status = subStatus
  if (condition !== undefined) patch.cosmetic_condition = condition
  if (donorOrg !== undefined) patch.donor_organization_id = donorOrg
  if (sourceDetail !== undefined) patch.source_detail = sourceDetail
  if (destinationOrg !== undefined) patch.destination_organization_id = destinationOrg
  if (technician !== undefined) patch.assigned_technician_id = technician
  for (const [field, value] of dates) {
    if (value !== undefined) patch[field] = value
  }

  const reason = ((formData.get('reason') as string) ?? '').trim().slice(0, 1000) || null

  /**
   * Stage milestones only *fill in* a missing date, so they can't ride along in
   * the shared patch — that would stamp today over dates the batch already has.
   * These are applied per-column after the main update, guarded on NULL.
   */
  const autoDates: Array<{ column: string; value: string }> = []

  if (stage) {
    patch.stage = stage
    // Mirrors changeStage: moving stage drops the in-process sub-status unless
    // this batch sets one explicitly.
    if (subStatus === undefined) patch.sub_status = null
    const today = new Date().toISOString().split('T')[0]
    if (stage === 'received' && !('date_received' in patch)) {
      autoDates.push({ column: 'date_received', value: today })
    }
    if (stage === 'distributed' && !('date_sent' in patch)) {
      autoDates.push({ column: 'date_sent', value: today })
    }
    if (stage === 'retired') {
      const retirementReason = choice('retirement_reason', RETIREMENT_REASONS)
      if (!retirementReason) {
        return {
          error: 'A retirement reason is required when setting the stage to Retired',
          message: null,
        }
      }
      patch.retirement_reason = retirementReason
      if (reason) patch.retirement_notes = reason
    }
  }

  if (!Object.keys(patch).length) {
    return { error: 'Choose at least one field to change', message: null }
  }

  const supabase = await createClient()

  // Read the current stages first — after the update the previous values are
  // gone, and stage_history needs both ends of the transition.
  const { data: before, error: readError } = await supabase
    .from('equipment')
    .select('id, stage, organization_id')
    .in('id', ids)

  if (readError) return { error: readError.message, message: null }
  if (!before?.length) return { error: 'No matching equipment found', message: null }

  // .select() reveals which rows RLS actually let through.
  const { data: updated, error: updateError } = await supabase
    .from('equipment')
    .update(patch)
    .in('id', ids)
    .select('id')

  if (updateError) return { error: updateError.message, message: null }

  const updatedIds = new Set((updated ?? []).map((r) => r.id))
  if (!updatedIds.size) return { error: 'Permission denied', message: null }

  let dateWarning = ''
  for (const { column, value } of autoDates) {
    const { error } = await supabase
      .from('equipment')
      .update({ [column]: value })
      .in('id', Array.from(updatedIds))
      .is(column, null)
    if (error) dateWarning += ` ${column} could not be stamped: ${error.message}`
  }

  let historyWarning = ''
  if (stage) {
    const history = before
      .filter((r) => updatedIds.has(r.id) && r.stage !== stage)
      .map((r) => ({
        organization_id: r.organization_id,
        equipment_id: r.id,
        from_stage: r.stage,
        to_stage: stage as EquipmentStage,
        user_id: ctx.userId,
        reason,
      }))

    if (history.length) {
      const { error: historyError } = await supabase.from('stage_history').insert(history)
      if (historyError) {
        historyWarning = ` Stage history could not be recorded: ${historyError.message}`
      }
    }
  }

  revalidatePath('/equipment')
  revalidatePath('/equipment/[id]', 'page')
  revalidatePath('/my-equipment')
  revalidatePath('/my-work')
  revalidatePath('/')

  const count = updatedIds.size
  const blocked = ids.length - count
  return {
    error: null,
    message:
      `Updated ${count} device${count !== 1 ? 's' : ''}.` +
      (blocked > 0
        ? ` ${blocked} skipped — no longer visible or blocked by permissions.`
        : '') +
      dateWarning +
      historyWarning,
  }
}
