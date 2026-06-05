'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SupportThreadStatus } from '@/lib/types'

export async function replyToThread(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const threadId = formData.get('thread_id') as string
  const body = (formData.get('body') as string).trim()
  if (!body) return { error: 'Message cannot be empty' }

  const { data: thread } = await supabase
    .from('support_threads')
    .select('organization_id')
    .eq('id', threadId)
    .single()

  if (!thread) return { error: 'Thread not found' }

  const { error } = await supabase.from('support_messages').insert({
    organization_id: thread.organization_id,
    support_thread_id: threadId,
    user_id: user.id,
    body,
  })

  if (error) return { error: error.message }

  revalidatePath(`/support/${threadId}`)
  return {}
}

export async function updateThreadStatus(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const threadId = formData.get('thread_id') as string
  const status = formData.get('status') as SupportThreadStatus

  const update: Record<string, unknown> = { status }
  if (status === 'closed' || status === 'resolved') {
    update.closed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('support_threads')
    .update(update)
    .eq('id', threadId)

  if (error) return { error: error.message }

  revalidatePath(`/support/${threadId}`)
  revalidatePath('/support')
  return {}
}
