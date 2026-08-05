import type { UserRole } from '@/lib/types'

/**
 * Admin "view as" support. Previewing changes what the UI *shows*, never what
 * the database *allows* — RLS still evaluates the real user's roles, so a
 * super admin previewing as a recipient keeps super-admin read/write access.
 */
export const ROLE_PREVIEW_COOKIE = 'oe_role_preview'

/** Most privileged first. */
export const ROLE_PRIORITY: UserRole[] = ['super_admin', 'org_admin', 'technician', 'recipient']

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Admin',
  technician: 'Technician',
  recipient: 'Recipient',
}

/** Roles an admin may preview: strictly less privileged than their own. */
export function previewableRolesFor(realRole: UserRole): UserRole[] {
  if (realRole !== 'super_admin' && realRole !== 'org_admin') return []
  return ROLE_PRIORITY.slice(ROLE_PRIORITY.indexOf(realRole) + 1)
}

export function isValidPreview(
  realRole: UserRole,
  candidate: string | null | undefined
): candidate is UserRole {
  return !!candidate && previewableRolesFor(realRole).includes(candidate as UserRole)
}

/** Where a given role should land — recipients have no dashboard. */
export function landingPathFor(role: UserRole): string {
  return role === 'recipient' ? '/my-equipment' : '/'
}
