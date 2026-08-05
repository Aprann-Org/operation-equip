import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import type { UserRole } from '@/lib/types'
import {
  ROLE_PREVIEW_COOKIE,
  ROLE_PRIORITY,
  isValidPreview,
  previewableRolesFor,
} from '@/lib/role-preview'

export type UserContext = {
  userId: string
  email: string
  role: UserRole                // effective role — the previewed one while previewing
  realRole: UserRole            // role actually granted in user_roles
  previewRole: UserRole | null  // set while an admin is viewing as someone else
  isPreviewingRole: boolean
  previewableRoles: UserRole[]  // empty for non-admins
  organizationId: string | null
  organizationName: string | null
  isSuperAdmin: boolean
  isOrgAdmin: boolean
  isTechnician: boolean
  isRecipient: boolean
  noRole: boolean              // authenticated but no user_roles entry yet
  canManageEquipment: boolean  // tech, org_admin, super_admin
  canManageUsers: boolean      // org_admin, super_admin
  canManageSettings: boolean   // org_admin, super_admin
  canManageOrganizations: boolean // org_admin, super_admin — matches the RLS insert/update policy
}

export const getCurrentUserContext = cache(async (): Promise<UserContext | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role, organization_id')
    .eq('user_id', user.id)

  // Account exists but has no role assigned yet
  if (!roles?.length) {
    return {
      userId: user.id,
      email: user.email ?? '',
      role: 'recipient',
      realRole: 'recipient',
      previewRole: null,
      isPreviewingRole: false,
      previewableRoles: [],
      organizationId: null,
      organizationName: null,
      isSuperAdmin: false,
      isOrgAdmin: false,
      isTechnician: false,
      isRecipient: false,
      noRole: true,
      canManageEquipment: false,
      canManageUsers: false,
      canManageSettings: false,
      canManageOrganizations: false,
    }
  }

  const topRole: UserRole = ROLE_PRIORITY.find(p => roles.some(r => r.role === p)) ?? 'recipient'
  const primaryRecord = roles.find(r => r.role === topRole)
  const orgId = primaryRecord?.organization_id ?? null

  // Role preview: only ever a downgrade, and only for roles the real role outranks
  const requestedPreview = (await cookies()).get(ROLE_PREVIEW_COOKIE)?.value
  const previewRole = isValidPreview(topRole, requestedPreview) ? requestedPreview : null
  const effectiveRole = previewRole ?? topRole

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
    role: effectiveRole,
    realRole: topRole,
    previewRole,
    isPreviewingRole: previewRole !== null,
    previewableRoles: previewableRolesFor(topRole),
    organizationId: orgId,
    organizationName: orgName,
    isSuperAdmin: effectiveRole === 'super_admin',
    isOrgAdmin: effectiveRole === 'org_admin',
    isTechnician: effectiveRole === 'technician',
    isRecipient: effectiveRole === 'recipient',
    noRole: false,
    canManageEquipment: effectiveRole !== 'recipient',
    canManageUsers: effectiveRole === 'super_admin' || effectiveRole === 'org_admin',
    canManageSettings: effectiveRole === 'super_admin' || effectiveRole === 'org_admin',
    canManageOrganizations: effectiveRole === 'super_admin' || effectiveRole === 'org_admin',
  }
})
