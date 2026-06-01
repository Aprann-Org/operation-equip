'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function updateItem(formData: FormData) {
  const id = Number(formData.get('id'))
  const name = formData.get('name') as string
  const description = formData.get('description') as string

  const supabase = await createClient()
  const { error } = await supabase
    .from('test_items')
    .update({ name, description })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/test')
}
