'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Self-assign an unclaimed device. The `is('assigned_technician_id', null)`
 * guard makes the claim a no-op when someone else got there first, so two
 * technicians hitting Claim at once can't silently overwrite each other.
 */
export async function claimDevice(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const equipmentId = formData.get('equipment_id') as string

  const { data: updated, error } = await supabase
    .from('equipment')
    .update({ assigned_technician_id: user.id })
    .eq('id', equipmentId)
    .is('assigned_technician_id', null)
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'Already claimed by someone else' }

  revalidatePath('/my-work')
  revalidatePath('/equipment')
  revalidatePath(`/equipment/${equipmentId}`)
  return {}
}

/** Hand a device back to the unassigned queue. Only the holder can release it. */
export async function releaseDevice(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const equipmentId = formData.get('equipment_id') as string

  const { data: updated, error } = await supabase
    .from('equipment')
    .update({ assigned_technician_id: null })
    .eq('id', equipmentId)
    .eq('assigned_technician_id', user.id)
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'Permission denied' }

  revalidatePath('/my-work')
  revalidatePath('/equipment')
  revalidatePath(`/equipment/${equipmentId}`)
  return {}
}
