import { createClient } from '@/utils/supabase/server'
import { STAGE_ORDER, STAGE_LABELS, type EquipmentStage } from '@/lib/types'
import styles from './page.module.css'

const ALL_STAGES: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  ...STAGE_ORDER.map((s) => ({ key: s, label: STAGE_LABELS[s] })),
  { key: 'in_support', label: 'In Support' },
  { key: 'retired', label: 'Retired' },
]

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  const { stage } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('equipment')
    .select(`
      id, internal_id, make, model, stage, cosmetic_condition, date_acquired, created_at,
      equipment_types!equipment_type_id ( name ),
      destination_org:organizations!destination_organization_id ( name )
    `)
    .order('created_at', { ascending: false })

  if (stage) query = query.eq('stage', stage)

  const { data: equipment, error } = await query

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipment</h1>
          <p className="page-subtitle">
            {equipment?.length ?? 0} device{equipment?.length !== 1 ? 's' : ''}
            {stage ? ` · ${STAGE_LABELS[stage as EquipmentStage] ?? stage}` : ''}
          </p>
        </div>
        <a href="/equipment/new" className="btn btn-primary">+ Add Equipment</a>
      </div>

      {/* Stage filter tabs */}
      <div className="tabs">
        {ALL_STAGES.map((s) => (
          <a
            key={s.key}
            href={s.key ? `/equipment?stage=${s.key}` : '/equipment'}
            className={`tab ${(stage ?? '') === s.key ? 'tab-active' : ''}`}
          >
            {s.label}
          </a>
        ))}
      </div>

      <div className="card">
        {error && <p className="form-error" style={{ margin: '1rem' }}>{error.message}</p>}

        {!equipment?.length ? (
          <div className="empty-state">
            <span className="empty-icon">📦</span>
            <span>No equipment found{stage ? ` in "${STAGE_LABELS[stage as EquipmentStage] ?? stage}"` : ''}.</span>
            <a href="/equipment/new" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
              Add first device
            </a>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Make / Model</th>
                  <th>Type</th>
                  <th>Stage</th>
                  <th>Condition</th>
                  <th>Destination</th>
                  <th>Acquired</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((e) => {
                  const type = (e.equipment_types as unknown as { name: string } | null)?.name
                  const dest = (e.destination_org as unknown as { name: string } | null)?.name
                  return (
                    <tr key={e.id}>
                      <td>
                        <a href={`/equipment/${e.id}`} className="table-link">
                          {e.internal_id}
                        </a>
                      </td>
                      <td>
                        {e.make || e.model
                          ? [e.make, e.model].filter(Boolean).join(' ')
                          : <span className="table-muted">—</span>}
                      </td>
                      <td className="table-muted">{type ?? '—'}</td>
                      <td>
                        <span className={`badge badge-${e.stage}`}>
                          {STAGE_LABELS[e.stage as EquipmentStage] ?? e.stage}
                        </span>
                      </td>
                      <td>
                        {e.cosmetic_condition
                          ? <span className={`badge badge-${e.cosmetic_condition}`}>{e.cosmetic_condition}</span>
                          : <span className="table-muted">—</span>}
                      </td>
                      <td className="table-muted">{dest ?? '—'}</td>
                      <td className="table-muted">
                        {e.date_acquired
                          ? new Date(e.date_acquired).toLocaleDateString()
                          : '—'}
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
  )
}
