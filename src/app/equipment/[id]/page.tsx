import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { STAGE_LABELS, STAGE_LABELS as SL, type EquipmentStage, type EquipmentSubStatus } from '@/lib/types'
import { StagePanel } from './StagePanel'
import { ChecklistPanel } from './ChecklistPanel'
import { NotesPanel } from './NotesPanel'
import { BatteryPanel } from './BatteryPanel'
import { DestinationForm } from './DestinationForm'
import { assignTechnician } from './actions'
import { getCurrentUserContext } from '@/lib/auth'
import styles from './page.module.css'

const SUB_STATUS_LABELS: Record<string, string> = {
  testing: 'Testing',
  repairing: 'Repairing',
  awaiting_parts: 'Awaiting Parts',
  awaiting_software: 'Awaiting Software',
  final_qa: 'Final QA',
  blocked: 'Blocked',
}

const RETIREMENT_REASON_LABELS: Record<string, string> = {
  lost: 'Lost',
  broken: 'Broken beyond repair',
  returned_to_donor: 'Returned to donor',
  end_of_life: 'End of life',
  other: 'Other',
}

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext()

  const { data: equip } = await supabase
    .from('equipment')
    .select(`
      *,
      equipment_type:equipment_types!equipment_type_id ( id, name ),
      donor_org:organizations!donor_organization_id ( name ),
      destination_org:organizations!destination_organization_id ( id, name ),
      destination_person:users!destination_person_id ( id, first_name, last_name, email ),
      equipment_notes ( id, note, visibility, created_at, user:users!user_id ( first_name, last_name, email ) ),
      stage_history ( id, from_stage, to_stage, occurred_at, reason, user:users!user_id ( first_name, last_name ) )
    `)
    .eq('id', id)
    .single()

  if (!equip) notFound()

  const equipType = equip.equipment_type as { id: string; name: string } | null

  // Parallel fetches: checklist, checklist results, battery reports, recipient orgs, org users
  const [checklistRes, checklistResultsRes, batteryRes, recipientOrgsRes, orgUsersRes, techRolesRes] = await Promise.all([
    equipType
      ? supabase
          .from('checklist_templates')
          .select('id, checklist_items ( id, order, label, result_type, required, help_text )')
          .eq('equipment_type_id', equipType.id)
          .eq('is_active', true)
          .limit(1)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('checklist_results')
      .select('id, equipment_id, checklist_item_id, result_boolean, result_text, result_numeric, completed_at')
      .eq('equipment_id', id),
    supabase
      .from('battery_reports')
      .select('id, report_date, design_capacity_mwh, full_charge_capacity_mwh, percent_of_design, cycle_count, estimated_runtime_minutes, source')
      .eq('equipment_id', id)
      .order('report_date', { ascending: false }),
    supabase
      .from('organizations')
      .select('id, name')
      .in('type', ['recipient', 'both'])
      .eq('status', 'active')
      .order('name'),
    // Org users for pickers — may be empty if caller lacks org_admin role
    supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .order('email'),
    // Technicians in this org
    supabase
      .from('user_roles')
      .select('user_id, users!user_id ( id, first_name, last_name, email )')
      .eq('organization_id', equip.organization_id)
      .in('role', ['technician', 'org_admin']),
  ])

  type LocalChecklistItem = { id: string; checklist_template_id: string; order: number; label: string; result_type: 'boolean' | 'text' | 'numeric'; required: boolean; help_text: string | null }
  const checklistItems = ((checklistRes.data as unknown as { checklist_items: LocalChecklistItem[] } | null)?.checklist_items ?? [])
  checklistItems.sort((a, b) => a.order - b.order)

  const checklistResults = checklistResultsRes.data ?? []
  const batteryReports = batteryRes.data ?? []
  const recipientOrgs = recipientOrgsRes.data ?? []
  const orgUsers = orgUsersRes.data ?? []
  type TechUser = { id: string; first_name: string; last_name: string; email: string }
  const technicians = (techRolesRes.data ?? [])
    .map(r => r.users as unknown as TechUser | null)
    .filter((u): u is TechUser => !!u)

  type LocalNote = { id: string; equipment_id: string; note: string; visibility: 'internal' | 'recipient_visible'; created_at: string; user: { first_name: string; last_name: string; email: string } | null }
  const notes = (equip.equipment_notes ?? []) as unknown as LocalNote[]
  notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const history = (equip.stage_history ?? []) as {
    id: string; from_stage: string | null; to_stage: string; occurred_at: string; reason: string | null;
    user: { first_name: string; last_name: string } | null
  }[]
  history.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  const donorOrg = equip.donor_org as { name: string } | null
  const destOrg = equip.destination_org as { id: string; name: string } | null
  const destPerson = equip.destination_person as { id: string; first_name: string; last_name: string; email: string } | null
  const stage = equip.stage as EquipmentStage
  const subStatus = equip.sub_status as EquipmentSubStatus | null
  const deviceName = [equip.make, equip.model].filter(Boolean).join(' ') || equip.internal_id

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className={styles.breadcrumb}>
            <a href="/equipment" className="table-link">Equipment</a>
            <span className={styles.sep}>›</span>
            <span>{equip.internal_id}</span>
          </div>
          <h1 className="page-title">{deviceName}</h1>
          <div className={styles.headerMeta}>
            {equipType && <span className="table-muted">{equipType.name}</span>}
            <span className={`badge badge-${stage}`}>{STAGE_LABELS[stage] ?? stage}</span>
            {subStatus && (
              <span className="badge" style={{ background: '#fff7ed', color: '#ea580c' }}>
                {SUB_STATUS_LABELS[subStatus] ?? subStatus}
              </span>
            )}
            {equip.cosmetic_condition && (
              <span className={`badge badge-${equip.cosmetic_condition}`}>{equip.cosmetic_condition}</span>
            )}
          </div>
        </div>
        <a href="/equipment" className="btn btn-secondary">← Back</a>
      </div>

      <div className={styles.layout}>
        {/* ── Left column ───────────────────────────────── */}
        <div className={styles.leftCol}>

          {/* Hardware specs */}
          <div className="card">
            <div className="card-header"><span className="card-title">Hardware</span></div>
            <div className="card-body">
              <dl className={styles.dl}>
                <dt>Internal ID</dt><dd>{equip.internal_id}</dd>
                <dt>Make</dt><dd>{equip.make ?? '—'}</dd>
                <dt>Model</dt><dd>{equip.model ?? '—'}</dd>
                <dt>Processor</dt><dd>{equip.processor ?? '—'}</dd>
                <dt>RAM</dt><dd>{equip.ram_gb != null ? `${equip.ram_gb} GB` : '—'}</dd>
                <dt>Disk</dt>
                <dd>
                  {[
                    equip.disk_capacity_gb != null ? `${equip.disk_capacity_gb} GB` : null,
                    equip.specs?.disk_type ? String(equip.specs.disk_type).toUpperCase() : null,
                  ].filter(Boolean).join(' · ') || '—'}
                </dd>
                {equip.specs?.screen_size_in != null && (
                  <><dt>Screen</dt><dd>{String(equip.specs.screen_size_in)}"</dd></>
                )}
                {equip.specs?.os && (
                  <><dt>OS</dt><dd>{String(equip.specs.os)}</dd></>
                )}
              </dl>
            </div>
          </div>

          {/* Provenance */}
          <div className="card">
            <div className="card-header"><span className="card-title">Provenance</span></div>
            <div className="card-body">
              <dl className={styles.dl}>
                <dt>Donor</dt><dd>{donorOrg?.name ?? '—'}</dd>
                <dt>Source</dt><dd>{equip.source_detail ?? '—'}</dd>
                <dt>Sponsor</dt>
                <dd>
                  {equip.sponsor_name
                    ? <>
                        {equip.sponsor_name}
                        {equip.sponsor_email && (
                          <> · <a href={`mailto:${equip.sponsor_email}`} className="table-link">{equip.sponsor_email}</a></>
                        )}
                      </>
                    : '—'}
                </dd>
              </dl>
            </div>
          </div>

          {/* Lifecycle & Destination */}
          <div className="card">
            <div className="card-header"><span className="card-title">Lifecycle &amp; Destination</span></div>
            <div className="card-body">
              <dl className={styles.dl}>
                <dt>Acquired</dt><dd>{equip.date_acquired ? new Date(equip.date_acquired).toLocaleDateString() : '—'}</dd>
                <dt>Received</dt><dd>{equip.date_received ? new Date(equip.date_received).toLocaleDateString() : '—'}</dd>
                <dt>Sent</dt><dd>{equip.date_sent ? new Date(equip.date_sent).toLocaleDateString() : '—'}</dd>
                <dt>Delivered</dt><dd>{equip.date_delivered ? new Date(equip.date_delivered).toLocaleDateString() : '—'}</dd>
                <dt>Tech Due</dt><dd>{equip.tech_due_date ? new Date(equip.tech_due_date).toLocaleDateString() : '—'}</dd>
              </dl>

              <hr className="divider" />
              <p className="section-label">Update Destination</p>
              <DestinationForm
                equipmentId={equip.id}
                currentDestOrgId={destOrg?.id ?? null}
                currentDestPersonId={destPerson?.id ?? null}
                currentTechDueDate={equip.tech_due_date ?? null}
                recipientOrgs={recipientOrgs}
                orgUsers={orgUsers}
              />
            </div>
          </div>

          {/* Retirement info — only if retired */}
          {stage === 'retired' && (
            <div className="card">
              <div className="card-header"><span className="card-title">Retirement</span></div>
              <div className="card-body">
                <dl className={styles.dl}>
                  <dt>Reason</dt>
                  <dd>{equip.retirement_reason ? RETIREMENT_REASON_LABELS[equip.retirement_reason] ?? equip.retirement_reason : '—'}</dd>
                  <dt>Notes</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{equip.retirement_notes ?? '—'}</dd>
                </dl>
              </div>
            </div>
          )}

          {/* Battery reports */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Battery Reports</span>
              <span className="table-muted" style={{ fontSize: 12 }}>{batteryReports.length} report{batteryReports.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="card-body">
              <BatteryPanel equipmentId={equip.id} reports={batteryReports} />
            </div>
          </div>

          {/* Stage history */}
          <div className="card">
            <div className="card-header"><span className="card-title">Stage History</span></div>
            {history.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem' }}>No history yet.</div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>From</th><th>To</th><th>By</th><th>When</th></tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="table-muted">
                          {h.from_stage ? SL[h.from_stage as EquipmentStage] ?? h.from_stage : '—'}
                        </td>
                        <td>
                          <span className={`badge badge-${h.to_stage}`}>
                            {SL[h.to_stage as EquipmentStage] ?? h.to_stage}
                          </span>
                        </td>
                        <td className="table-muted">
                          {h.user ? `${h.user.first_name} ${h.user.last_name}`.trim() || 'System' : 'System'}
                        </td>
                        <td className="table-muted">{new Date(h.occurred_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ──────────────────────────────── */}
        <div className={styles.rightCol}>
          {/* Stage panel */}
          <div className="card">
            <div className="card-header"><span className="card-title">Stage</span></div>
            <div className="card-body">
              <StagePanel
                equipmentId={equip.id}
                currentStage={stage}
                currentSubStatus={subStatus}
              />
            </div>
          </div>

          {/* QA Checklist */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">QA Checklist</span>
              <span className="table-muted" style={{ fontSize: 12 }}>
                {checklistResults.length}/{checklistItems.length}
              </span>
            </div>
            <div className="card-body">
              <ChecklistPanel
                equipmentId={equip.id}
                items={checklistItems}
                results={checklistResults}
              />
            </div>
          </div>

          {/* Technician assignment — shown to admin/tech only */}
          {ctx?.canManageEquipment && (
            <div className="card">
              <div className="card-header"><span className="card-title">Assigned Technician</span></div>
              <div className="card-body">
                {equip.assigned_technician_id && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Currently: {
                      technicians.find(t => t.id === equip.assigned_technician_id)
                        ? (() => { const t = technicians.find(u => u.id === equip.assigned_technician_id)!; return `${t.first_name} ${t.last_name}`.trim() || t.email })()
                        : 'Unknown'
                    }
                  </p>
                )}
                <form action={assignTechnician} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input type="hidden" name="equipment_id" value={equip.id} />
                  <select name="technician_id" defaultValue={equip.assigned_technician_id ?? ''} className="select">
                    <option value="">Unassigned</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>
                        {`${t.first_name} ${t.last_name}`.trim() || t.email}
                      </option>
                    ))}
                  </select>
                  <div className="field">
                    <label className="label">Tech Due Date</label>
                    <input name="tech_due_date" type="date" defaultValue={equip.tech_due_date ?? ''} className="input" />
                  </div>
                  <button type="submit" className="btn btn-secondary btn-sm">Save</button>
                </form>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="card">
            <div className="card-header"><span className="card-title">Notes</span></div>
            <div className="card-body">
              <NotesPanel equipmentId={equip.id} notes={notes} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
