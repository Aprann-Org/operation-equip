import { createClient } from '@/utils/supabase/server'
import type { OrgType } from '@/lib/types'

const TYPE_FILTER: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'tenant', label: 'Tenant' },
  { key: 'donor', label: 'Donor' },
  { key: 'recipient', label: 'Recipient' },
  { key: 'both', label: 'Both' },
]

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('organizations')
    .select('*')
    .order('name')

  if (type) query = query.eq('type', type)

  const { data: orgs, error } = await query

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Organizations</h1>
          <p className="page-subtitle">{orgs?.length ?? 0} organization{orgs?.length !== 1 ? 's' : ''}</p>
        </div>
        <a href="/organizations/new" className="btn btn-primary">+ Add Organization</a>
      </div>

      <div className="tabs">
        {TYPE_FILTER.map((t) => (
          <a
            key={t.key}
            href={t.key ? `/organizations?type=${t.key}` : '/organizations'}
            className={`tab ${(type ?? '') === t.key ? 'tab-active' : ''}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="card">
        {error && <p className="form-error" style={{ margin: '1rem' }}>{error.message}</p>}

        {!orgs?.length ? (
          <div className="empty-state">
            <span className="empty-icon">🏢</span>
            <span>No organizations found.</span>
            <a href="/organizations/new" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
              Add first organization
            </a>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Key Contact</th>
                  <th>EIN</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td>
                      <a href={`/organizations/${org.id}`} className="table-link">{org.name}</a>
                    </td>
                    <td>
                      <span className={`badge badge-${org.type as OrgType}`}>{org.type}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${org.status}`}>{org.status}</span>
                    </td>
                    <td className="table-muted">
                      {org.key_contact_name ?? '—'}
                      {org.key_contact_email && (
                        <div style={{ fontSize: 12 }}>{org.key_contact_email}</div>
                      )}
                    </td>
                    <td className="table-muted">{org.ein ?? '—'}</td>
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
