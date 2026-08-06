'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUserContext } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/lib/types'

async function assertAdmin() {
  const ctx = await getCurrentUserContext()
  if (!ctx?.canManageUsers) throw new Error('Permission denied')
  return ctx
}

export async function inviteUser(
  _prev: { error: string | null; success: string | null },
  formData: FormData
): Promise<{ error: string | null; success: string | null }> {
  const ctx = await assertAdmin().catch(() => null)
  if (!ctx) return { error: 'Permission denied', success: null }

  const email = (formData.get('email') as string).trim().toLowerCase()
  const role = formData.get('role') as UserRole
  const firstName = (formData.get('first_name') as string).trim()
  const lastName = (formData.get('last_name') as string).trim()

  if (!email || !role) return { error: 'Email and role are required', success: null }
  if (!ctx.organizationId && !ctx.isSuperAdmin) {
    return { error: 'No organization associated with your account', success: null }
  }

  const orgId = ctx.organizationId

  try {
    const adminClient = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/auth/callback`,
      data: {
        first_name: firstName,
        last_name: lastName,
        invited_role: role,
        invited_org_id: orgId,
      },
    })

    if (error) return { error: error.message, success: null }

    revalidatePath('/settings/users')
    return { error: null, success: `Invitation sent to ${email}` }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Invite failed',
      success: null,
    }
  }
}

export async function changeUserRole(formData: FormData): Promise<{ error?: string }> {
  const ctx = await assertAdmin().catch(() => null)
  if (!ctx) return { error: 'Permission denied' }

  const targetUserId = formData.get('user_id') as string
  const newRole = formData.get('role') as UserRole
  const orgId = ctx.organizationId

  if (!orgId) return { error: 'No organization found' }

  const supabase = await createClient()

  // Replaces whatever role the user held in this org. An upsert can't do
  // this — user_roles is unique on (user_id, organization_id, role), so a
  // different role never conflicts and the user would end up holding both.
  const { error } = await supabase.rpc('set_user_role', {
    p_user_id: targetUserId,
    p_organization_id: orgId,
    p_role: newRole,
  })

  if (error) return { error: error.message }

  revalidatePath('/settings/users')
  return {}
}

/**
 * Grant a role to an account that signed in but has no role anywhere —
 * i.e. someone sitting in the pending queue. Same RPC as a role change;
 * separated so the UI can report "granted access" rather than "updated".
 */
export async function grantPendingUserRole(
  _prev: { error: string | null; success: string | null },
  formData: FormData
): Promise<{ error: string | null; success: string | null }> {
  const ctx = await assertAdmin().catch(() => null)
  if (!ctx) return { error: 'Permission denied', success: null }

  const targetUserId = formData.get('user_id') as string
  const role = formData.get('role') as UserRole
  const orgId = ctx.organizationId

  if (!targetUserId || !role) return { error: 'User and role are required', success: null }
  if (!orgId) {
    return {
      error: 'Your account is not attached to an organization, so it cannot grant access.',
      success: null,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_user_role', {
    p_user_id: targetUserId,
    p_organization_id: orgId,
    p_role: role,
  })

  if (error) return { error: error.message, success: null }

  revalidatePath('/settings/users')
  return { error: null, success: 'Access granted' }
}

export async function removeUserFromOrg(formData: FormData): Promise<{ error?: string }> {
  const ctx = await assertAdmin().catch(() => null)
  if (!ctx) return { error: 'Permission denied' }

  const targetUserId = formData.get('user_id') as string
  const orgId = ctx.organizationId

  if (!orgId && !ctx.isSuperAdmin) return { error: 'No organization found' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', targetUserId)
    .eq('organization_id', orgId as string)

  if (error) return { error: error.message }

  revalidatePath('/settings/users')
  return {}
}
