'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { EquipmentStage } from '@/lib/types'

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
