'use server'

import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const ctx = await getCurrentUserContext()
  if (!ctx?.canManageSettings) throw new Error('Permission denied')
  return ctx
}

export async function createTemplate(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const ctx = await assertAdmin().catch(() => null)
  if (!ctx?.organizationId) return { error: 'Permission denied' }

  const supabase = await createClient()
  const equipmentTypeId = formData.get('equipment_type_id') as string
  const name = (formData.get('name') as string).trim()
  if (!name || !equipmentTypeId) return { error: 'Name and equipment type are required' }

  // Deactivate existing active template for this type
  await supabase
    .from('checklist_templates')
    .update({ is_active: false })
    .eq('organization_id', ctx.organizationId)
    .eq('equipment_type_id', equipmentTypeId)
    .eq('is_active', true)

  const { data: existing } = await supabase
    .from('checklist_templates')
    .select('version')
    .eq('organization_id', ctx.organizationId)
    .eq('equipment_type_id', equipmentTypeId)
    .order('version', { ascending: false })
    .limit(1)

  const nextVersion = (existing?.[0]?.version ?? 0) + 1

  const { error } = await supabase.from('checklist_templates').insert({
    organization_id: ctx.organizationId,
    equipment_type_id: equipmentTypeId,
    name,
    version: nextVersion,
    is_active: true,
    created_by_user_id: ctx.userId,
  })

  if (error) return { error: error.message }

  revalidatePath('/settings/checklists')
  return { error: null }
}

export async function addChecklistItem(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const ctx = await assertAdmin().catch(() => null)
  if (!ctx) return { error: 'Permission denied' }

  const supabase = await createClient()
  const templateId = formData.get('template_id') as string
  const label = (formData.get('label') as string).trim()
  if (!label) return { error: 'Label is required' }

  // Get max order for this template
  const { data: items } = await supabase
    .from('checklist_items')
    .select('"order"')
    .eq('checklist_template_id', templateId)
    .order('"order"', { ascending: false })
    .limit(1)

  const nextOrder = (items?.[0]?.order ?? 0) + 1

  const { error } = await supabase.from('checklist_items').insert({
    checklist_template_id: templateId,
    order: nextOrder,
    label,
    result_type: (formData.get('result_type') as string) ?? 'boolean',
    required: formData.get('required') === 'true',
    help_text: (formData.get('help_text') as string) || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/settings/checklists')
  return { error: null }
}

export async function deleteChecklistItem(formData: FormData): Promise<{ error?: string }> {
  const ctx = await assertAdmin().catch(() => null)
  if (!ctx) return { error: 'Permission denied' }

  const supabase = await createClient()
  const itemId = formData.get('item_id') as string

  // Only allow deleting items that have no results yet
  const { data: results } = await supabase
    .from('checklist_results')
    .select('id')
    .eq('checklist_item_id', itemId)
    .limit(1)

  if (results?.length) {
    return { error: 'Cannot delete an item that has recorded results. Create a new template version instead.' }
  }

  const { error } = await supabase
    .from('checklist_items')
    .delete()
    .eq('id', itemId)

  if (error) return { error: error.message }

  revalidatePath('/settings/checklists')
  return {}
}
