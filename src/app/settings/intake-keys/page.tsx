import { getCurrentUserContext } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { CreateKeyForm } from './CreateKeyForm'
import { revokeIntakeKey } from './actions'

export const metadata = { title: 'Intake Keys — Settings' }

type IntakeKeyRow = {
  id: string
  label: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
  creator: { first_name: string; last_name: string } | null
}

export default async function IntakeKeysSettingsPage() {
  const ctx = await getCurrentUserContext()

  if (!ctx?.organizationId) {
    return (
      <div className="card">
        <div className="empty-state">
          <span>Your account has no organization, so there are no intake keys to manage.</span>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('intake_api_keys')
    .select('id, label, key_prefix, created_at, last_used_at, revoked_at, creator:users!created_by_user_id ( first_name, last_name )')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false })

  const keys = (data ?? []) as unknown as IntakeKeyRow[]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Intake Keys</h1>
          <p className="page-subtitle">
            API keys for the laptop intake script, which reads a laptop&apos;s specs and fills in its record.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header"><span className="card-title">How it works</span></div>
        <div className="card-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
          <ol style={{ paddingLeft: '1.2rem', margin: 0 }}>
            <li>Add the laptop in Equipment as usual, with its laptop number.</li>
            <li>
              Copy <code>scripts/intake/Invoke-EquipIntake.ps1</code> to a USB stick, and create a key below.
            </li>
            <li>
              On the laptop, run{' '}
              <code>powershell -ExecutionPolicy Bypass -File Invoke-EquipIntake.ps1</code> and enter the
              laptop number when asked.
            </li>
          </ol>
          <p className="field-hint" style={{ marginTop: 8 }}>
            The first scan links the laptop&apos;s serial number to its record. After that, a mistyped
            laptop number is rejected instead of overwriting another laptop. Only blank fields are filled
            unless the script is run with <code>-Overwrite</code>.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header"><span className="card-title">New Key</span></div>
        <div className="card-body">
          <CreateKeyForm />
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Keys</span></div>
        {keys.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🔑</span>
            <span>No intake keys yet. Create one above.</span>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Key</th>
                  <th>Created</th>
                  <th>Last Used</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>{k.label}</td>
                    <td className="table-muted" style={{ fontFamily: 'monospace' }}>{k.key_prefix}…</td>
                    <td className="table-muted">
                      {new Date(k.created_at).toLocaleDateString()}
                      {k.creator && ` · ${`${k.creator.first_name} ${k.creator.last_name}`.trim()}`}
                    </td>
                    <td className="table-muted">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                    </td>
                    <td>
                      <span className={`badge ${k.revoked_at ? 'badge-archived' : 'badge-active'}`}>
                        {k.revoked_at ? 'Revoked' : 'Active'}
                      </span>
                    </td>
                    <td>
                      {!k.revoked_at && (
                        <form action={revokeIntakeKey}>
                          <input type="hidden" name="id" value={k.id} />
                          <button type="submit" className="btn btn-secondary btn-sm">Revoke</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
