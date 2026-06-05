'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createOrganization(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = (formData.get('name') as string).trim()
  if (!name) return { error: 'Name is required' }

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name,
      type: formData.get('type') as string,
      ein: (formData.get('ein') as string) || null,
      key_contact_name: (formData.get('key_contact_name') as string) || null,
      key_contact_email: (formData.get('key_contact_email') as string) || null,
      address: (formData.get('address') as string) || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  redirect(`/organizations/${org.id}`)
}

export async function updateOrganization(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { error } = await supabase
    .from('organizations')
    .update({
      name: (formData.get('name') as string).trim(),
      type: formData.get('type') as string,
      status: formData.get('status') as string,
      ein: (formData.get('ein') as string) || null,
      key_contact_name: (formData.get('key_contact_name') as string) || null,
      key_contact_email: (formData.get('key_contact_email') as string) || null,
      address: (formData.get('address') as string) || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/organizations/${id}`)
  revalidatePath('/organizations')
  return { error: null }
}
