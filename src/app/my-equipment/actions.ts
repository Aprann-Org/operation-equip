'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function confirmDelivery(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const equipmentId = formData.get('equipment_id') as string
  const today = new Date().toISOString().split('T')[0]

  await supabase
    .from('equipment')
    .update({ date_delivered: today })
    .eq('id', equipmentId)

  revalidatePath('/my-equipment')
}

export async function openSupportThread(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const equipmentId = formData.get('equipment_id') as string
  const subject = (formData.get('subject') as string).trim()
  if (!subject) return

  const { data: equip } = await supabase
    .from('equipment')
    .select('organization_id')
    .eq('id', equipmentId)
    .single()

  if (!equip) return

  const { data: thread, error } = await supabase
    .from('support_threads')
    .insert({
      organization_id: equip.organization_id,
      equipment_id: equipmentId,
      opened_by_user_id: user.id,
      subject,
    })
    .select('id')
    .single()

  if (error || !thread) return

  redirect(`/support/${thread.id}`)
}
