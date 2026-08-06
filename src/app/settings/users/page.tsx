import { getCurrentUserContext } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { UserList, InviteForm, PendingList } from './UserList'

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

  // Accounts that have signed up but hold no role anywhere yet. The RPC
  // returns an empty set for non-admins, so no extra guard is needed here.
  const { data: pendingRows } = await supabase.rpc('pending_users')

  const pending = (pendingRows ?? []).map((u: {
    id: string; first_name: string; last_name: string; email: string; created_at: string
  }) => ({
    userId: u.id,
    firstName: u.first_name ?? '',
    lastName: u.last_name ?? '',
    email: u.email,
    signedUpAt: u.created_at,
  }))

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

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">Awaiting access</span>
            <span className="badge badge-in_process">{pending.length} pending</span>
          </div>
          <div className="card-body">
            <p className="table-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              These people have created an account but don&apos;t have a role yet, so they
              can&apos;t use the app. Pick a role to give them access to{' '}
              {ctx!.organizationName ?? 'your organization'}.
            </p>
            <PendingList users={pending} />
          </div>
        </div>
      )}

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
