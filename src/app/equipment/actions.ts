'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
