import { getCurrentUserContext } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { UserList, InviteForm } from './UserList'

export const metadata = { title: 'Users & Roles — Settings' }

export default async function UsersSettingsPage() {
  const ctx = await getCurrentUserContext()
  const supabase = await createClient()

  // Fetch members of the org with their roles and user info
  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role, user_id, users!user_id ( id, first_name, last_name, email, status )')
    .eq('organization_id', ctx!.organizationId as string)
    .order('role')

  const members = (roleRows ?? []).map(r => {
    const u = r.users as unknown as {
      id: string; first_name: string; last_name: string; email: string; status: string
    } | null
    return {
      userId: r.user_id,
      firstName: u?.first_name ?? '',
      lastName: u?.last_name ?? '',
      email: u?.email ?? '—',
      role: r.role,
      status: u?.status ?? 'unknown',
    }
  })

  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users &amp; Roles</h1>
          <p className="page-subtitle">
            Manage who has access to {ctx!.organizationName ?? 'your organization'}.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Members</span>
          <span className="table-muted" style={{ fontSize: 12 }}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="card-body">
          {members.length === 0 ? (
            <p className="table-muted">No members yet.</p>
          ) : (
            <UserList members={members} />
          )}

          {hasServiceRoleKey ? (
            <InviteForm />
          ) : (
            <div className="form-error" style={{ marginTop: '1rem' }}>
              <strong>Invite disabled:</strong> Add <code>SUPABASE_SERVICE_ROLE_KEY</code> and{' '}
              <code>NEXT_PUBLIC_APP_URL</code> to <code>.env.local</code> to enable user invitations.
              You can manually add users via the{' '}
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                Supabase dashboard
              </a>.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
