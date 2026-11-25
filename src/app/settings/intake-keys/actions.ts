'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth'
import { generateIntakeKey } from '@/lib/intake-keys'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LABEL = 100

export type CreateKeyState = { error: string | null; key: string | null; label: string | null }

/**
 * Creates an intake API key for the admin's organization. The key is returned
 * once, here, and never again — only its hash is stored.
 */
export async function createIntakeKey(
  _prev: CreateKeyState,
  formData: FormData
): Promise<CreateKeyState> {
  const ctx = await getCurrentUserContext()
  // Server Actions are reachable by direct POST, so the role is re-checked here.
  if (!ctx?.canManageSettings) return { error: 'Permission denied', key: null, label: null }
  if (!ctx.organizationId) return { error: 'Your account has no organization', key: null, label: null }

  const label = ((formData.get('label') as string) ?? '').trim()
  if (!label) return { error: 'Give the key a label, e.g. "Bench USB stick"', key: null, label: null }
  if (label.length > MAX_LABEL) return { error: `Label must be ${MAX_LABEL} characters or fewer`, key: null, label: null }

  const { key, prefix, hash } = generateIntakeKey()
  const supabase = await createClient()
  const { error } = await supabase.from('intake_api_keys').insert({
    organization_id: ctx.organizationId,
    label,
    key_prefix: prefix,
    key_hash: hash,
    created_by_user_id: ctx.userId,
  })
  if (error) return { error: error.message, key: null, label: null }

  revalidatePath('/settings/intake-keys')
  return { error: null, key, label }
}

/** Revoking is immediate and permanent: the next request with that key gets a 401. */
export async function revokeIntakeKey(formData: FormData): Promise<void> {
  const ctx = await getCurrentUserContext()
  if (!ctx?.canManageSettings || !ctx.organizationId) return

  const id = formData.get('id')
  if (typeof id !== 'string' || !UUID_RE.test(id)) return

  const supabase = await createClient()
  await supabase
    .from('intake_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .is('revoked_at', null)

  revalidatePath('/settings/intake-keys')
}
