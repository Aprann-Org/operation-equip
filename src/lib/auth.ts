import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'
import type { UserRole } from '@/lib/types'

export type UserContext = {
  userId: string
  email: string
  role: UserRole
  organizationId: string | null
  organizationName: string | null
  isSuperAdmin: boolean
  isOrgAdmin: boolean
  isTechnician: boolean
  isRecipient: boolean
  canManageEquipment: boolean  // tech, org_admin, super_admin
  canManageUsers: boolean      // org_admin, super_admin
  canManageSettings: boolean   // org_admin, super_admin
}

// React cache() deduplicates this call within a single request tree.
// Layout and every page that calls it share one DB round-trip.
export const getCurrentUserContext = cache(async (): Promise<UserContext | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role, organization_id')
    .eq('user_id', user.id)

  // Priority order for "primary" role
  const PRIORITY: UserRole[] = ['super_admin', 'org_admin', 'technician', 'recipient']
  const topRole: UserRole = PRIORITY.find(p => roles?.some(r => r.role === p)) ?? 'recipient'
  const primaryRecord = roles?.find(r => r.role === topRole)
  const orgId = primaryRecord?.organization_id ?? null

  let orgName: string | null = null
  if (orgId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single()
    orgName = org?.name ?? null
  }

  return {
    userId: user.id,
    email: user.email ?? '',
    role: topRole,
    organizationId: orgId,
    organizationName: orgName,
    isSuperAdmin: topRole === 'super_admin',
    isOrgAdmin: topRole === 'org_admin',
    isTechnician: topRole === 'technician',
    isRecipient: topRole === 'recipient',
    canManageEquipment: topRole !== 'recipient',
    canManageUsers: topRole === 'super_admin' || topRole === 'org_admin',
    canManageSettings: topRole === 'super_admin' || topRole === 'org_admin',
  }
})
