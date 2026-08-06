'use client'

import { useActionState } from 'react'
import { changeUserRole, removeUserFromOrg, inviteUser, grantPendingUserRole } from './actions'
import styles from './UserList.module.css'

type OrgMember = {
  userId: string
  firstName: string
  lastName: string
  email: string
  role: string
  status: string
}

type PendingUser = {
  userId: string
  firstName: string
  lastName: string
  email: string
  signedUpAt: string
}

const ASSIGNABLE_ROLES = [
  { value: 'org_admin', label: 'Organization Admin' },
  { value: 'technician', label: 'Technician' },
  { value: 'recipient', label: 'Recipient' },
]

export function UserList({ members }: { members: OrgMember[] }) {
  return (
    <div className={styles.list}>
      {members.map(m => (
        <MemberRow key={m.userId} member={m} />
      ))}
    </div>
  )
}

function MemberRow({ member: m }: { member: OrgMember }) {
  const [roleState, roleAction, rolePending] = useActionState(
    async (_prev: { error?: string }, fd: FormData) => changeUserRole(fd),
    {}
  )
  const [removeState, removeAction, removePending] = useActionState(
    async (_prev: { error?: string }, fd: FormData) => removeUserFromOrg(fd),
    {}
  )

  const displayName = `${m.firstName} ${m.lastName}`.trim() || m.email

  return (
    <div className={styles.row}>
      <div className={styles.identity}>
        <span className={styles.name}>{displayName}</span>
        <span className={styles.email}>{m.email}</span>
      </div>

      <div className={styles.actions}>
        <span className={`badge badge-${m.status}`}>{m.status}</span>

        <form action={roleAction} className={styles.roleForm}>
          <input type="hidden" name="user_id" value={m.userId} />
          <select name="role" defaultValue={m.role} className="select" style={{ fontSize: 13, padding: '5px 8px' }}>
            {ASSIGNABLE_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button type="submit" disabled={rolePending} className="btn btn-secondary btn-sm">
            {rolePending ? '…' : 'Set'}
          </button>
        </form>

        <form action={removeAction}>
          <input type="hidden" name="user_id" value={m.userId} />
          <button
            type="submit"
            disabled={removePending}
            className="btn btn-danger btn-sm"
            onClick={(e) => { if (!confirm(`Remove ${displayName} from the organization?`)) e.preventDefault() }}
          >
            Remove
          </button>
        </form>
      </div>

      {(roleState.error || removeState.error) && (
        <p className="form-error" style={{ gridColumn: '1/-1' }}>
          {roleState.error ?? removeState.error}
        </p>
      )}
    </div>
  )
}

export function PendingList({ users }: { users: PendingUser[] }) {
  return (
    <div className={styles.list}>
      {users.map(u => (
        <PendingRow key={u.userId} user={u} />
      ))}
    </div>
  )
}

function PendingRow({ user: u }: { user: PendingUser }) {
  const [state, formAction, isPending] = useActionState(grantPendingUserRole, {
    error: null,
    success: null,
  })

  const displayName = `${u.firstName} ${u.lastName}`.trim() || u.email
  const signedUp = new Date(u.signedUpAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className={styles.row}>
      <div className={styles.identity}>
        <span className={styles.name}>{displayName}</span>
        <span className={styles.email}>{u.email}</span>
      </div>

      <div className={styles.actions}>
        <span className={styles.signedUp}>Signed up {signedUp}</span>

        <form action={formAction} className={styles.roleForm}>
          <input type="hidden" name="user_id" value={u.userId} />
          <select
            name="role"
            required
            defaultValue=""
            className="select"
            style={{ fontSize: 13, padding: '5px 8px' }}
          >
            <option value="" disabled>Choose a role…</option>
            {ASSIGNABLE_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
            {isPending ? '…' : 'Grant access'}
          </button>
        </form>
      </div>

      {state.error && (
        <p className="form-error" style={{ gridColumn: '1/-1' }}>{state.error}</p>
      )}
    </div>
  )
}

export function InviteForm() {
  const [state, formAction, isPending] = useActionState(inviteUser, { error: null, success: null })

  return (
    <div className={styles.inviteBox}>
      <p className={styles.inviteTitle}>Invite New User</p>
      {state.error && <p className="form-error">{state.error}</p>}
      {state.success && (
        <p style={{ fontSize: 13, color: 'var(--green)', marginBottom: 8 }}>{state.success}</p>
      )}
      <form action={formAction} className={styles.inviteForm}>
        <div className="form-grid">
          <div className="field">
            <label className="label">First Name</label>
            <input name="first_name" className="input" placeholder="Jane" />
          </div>
          <div className="field">
            <label className="label">Last Name</label>
            <input name="last_name" className="input" placeholder="Doe" />
          </div>
          <div className="field">
            <label className="label">Email *</label>
            <input name="email" type="email" required className="input" placeholder="jane@org.org" />
          </div>
          <div className="field">
            <label className="label">Role *</label>
            <select name="role" required className="select">
              {ASSIGNABLE_ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
          {isPending ? 'Sending…' : 'Send Invitation'}
        </button>
      </form>
    </div>
  )
}
