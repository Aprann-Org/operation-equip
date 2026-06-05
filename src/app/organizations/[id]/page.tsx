import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { STAGE_LABELS, type EquipmentStage, type OrgType } from '@/lib/types'
import styles from './page.module.css'

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single()

  if (!org) notFound()

  // Equipment where this org is the donor OR destination
  const { data: equipment } = await supabase
    .from('equipment')
    .select(`
      id, internal_id, make, model, stage,
      equipment_types!equipment_type_id ( name )
    `)
    .or(`donor_organization_id.eq.${id},destination_organization_id.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className={styles.breadcrumb}>
            <a href="/organizations" className="table-link">Organizations</a>
            <span className={styles.sep}>›</span>
            <span>{org.name}</span>
          </div>
          <h1 className="page-title">{org.name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <span className={`badge badge-${org.type as OrgType}`}>{org.type}</span>
            <span className={`badge badge-${org.status}`}>{org.status}</span>
          </div>
        </div>
        <a href="/organizations" className="btn btn-secondary">← Back</a>
      </div>

      <div className={styles.layout}>
        {/* Details card */}
        <div className="card">
          <div className="card-header"><span className="card-title">Details</span></div>
          <div className="card-body">
            <dl className={styles.dl}>
              <dt>EIN</dt><dd>{org.ein ?? '—'}</dd>
              <dt>Key Contact</dt><dd>{org.key_contact_name ?? '—'}</dd>
              <dt>Email</dt>
              <dd>
                {org.key_contact_email
                  ? <a href={`mailto:${org.key_contact_email}`} className="table-link">{org.key_contact_email}</a>
                  : '—'}
              </dd>
              <dt>Address</dt><dd style={{ whiteSpace: 'pre-line' }}>{org.address ?? '—'}</dd>
              <dt>Created</dt><dd>{new Date(org.created_at).toLocaleDateString()}</dd>
            </dl>
          </div>
        </div>

        {/* Equipment */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Associated Equipment</span>
            <span className="table-muted" style={{ fontSize: 12 }}>{equipment?.length ?? 0} devices</span>
          </div>
          {!equipment?.length ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <span>No equipment linked to this organization.</span>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>ID</th><th>Device</th><th>Type</th><th>Stage</th></tr>
                </thead>
                <tbody>
                  {equipment.map((e) => {
                    const typeName = (e.equipment_types as unknown as { name: string } | null)?.name
                    return (
                      <tr key={e.id}>
                        <td>
                          <a href={`/equipment/${e.id}`} className="table-link">{e.internal_id}</a>
                        </td>
                        <td>{[e.make, e.model].filter(Boolean).join(' ') || '—'}</td>
                        <td className="table-muted">{typeName ?? '—'}</td>
                        <td>
                          <span className={`badge badge-${e.stage}`}>
                            {STAGE_LABELS[e.stage as EquipmentStage] ?? e.stage}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
