import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth'
import { formatDate } from '@/app/equipment/table-config'
import {
  COSMETIC_CONDITION_LABELS,
  STAGE_COLORS,
  STAGE_LABELS,
  SUB_STATUS_LABELS,
  type CosmeticCondition,
  type EquipmentStage,
} from '@/lib/types'
import { ClaimButton, RowActions } from './RowActions'
import { getMyWorkItems, one } from './data'
import {
  ACTIVE_STAGES,
  WORK_VIEWS,
  byUrgency,
  daysUntil,
  describeDue,
  isWorkView,
  matchesView,
  type WorkView,
} from './work-queue'
import styles from './page.module.css'

export const metadata = { title: 'My Work — Operation Equip' }

/** How many unclaimed devices to surface at the bottom of the page. */
const CLAIMABLE_LIMIT = 8

export default async function MyWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const ctx = await getCurrentUserContext()
  if (!ctx) redirect('/login')
  // Recipients have no assignment queue — /my-equipment is their view.
  if (!ctx.canManageEquipment) redirect('/my-equipment')

  const params = await searchParams
  const view: WorkView = isWorkView(params.view) ? params.view : 'active'

  const supabase = await createClient()

  const [{ items, error }, claimableRes] = await Promise.all([
    getMyWorkItems(ctx.userId),
    // RLS already scopes this to the caller's organizations.
    supabase
      .from('equipment')
      .select(`
        id, internal_id, make, model, stage, sub_status, tech_due_date,
        equipment_type:equipment_types!equipment_type_id ( name )
      `)
      .is('assigned_technician_id', null)
      .in('stage', ACTIVE_STAGES)
      .order('tech_due_date', { ascending: true, nullsFirst: false })
      .limit(CLAIMABLE_LIMIT),
  ])

  const counts = Object.fromEntries(
    WORK_VIEWS.map((v) => [v.key, items.filter((i) => matchesView(i, v.key)).length])
  ) as Record<WorkView, number>

  const visible = items.filter((i) => matchesView(i, view)).sort(byUrgency)

  const active = items.filter((i) => matchesView(i, 'active'))
  const dueSoon = active.filter((i) => i.daysUntilDue !== null && i.daysUntilDue > 0 && i.daysUntilDue <= 7).length
  const openThreads = active.reduce((sum, i) => sum + i.openThreads, 0)

  const claimable = (claimableRes.data ?? []).map((e) => ({
    id: e.id,
    internalId: e.internal_id,
    deviceName: [e.make, e.model].filter(Boolean).join(' ') || e.internal_id,
    typeName: one<{ name: string }>(e.equipment_type)?.name ?? null,
    stage: e.stage as EquipmentStage,
    dueDate: e.tech_due_date,
    daysUntilDue: daysUntil(e.tech_due_date),
  }))

  const summary = [
    { label: 'On my bench', value: counts.active, tone: '' as const, view: 'active' as WorkView },
    { label: 'Overdue', value: counts.overdue, tone: 'overdue' as const, view: 'overdue' as WorkView },
    // No dedicated view — the Active queue is already sorted by urgency.
    { label: 'Due this week', value: dueSoon, tone: 'soon' as const, view: null },
    { label: 'Blocked', value: counts.blocked, tone: 'blocked' as const, view: 'blocked' as WorkView },
    { label: 'Open threads', value: openThreads, tone: '' as const, view: null },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Work</h1>
          <p className="page-subtitle">
            {counts.active === 0
              ? 'Nothing is assigned to you right now.'
              : `${counts.active} device${counts.active !== 1 ? 's' : ''} on your bench` +
                (counts.overdue ? ` · ${counts.overdue} overdue` : '')}
          </p>
        </div>
        <a href="/equipment" className="btn btn-secondary">All Equipment</a>
      </div>

      {error && <p className="form-error">{error}</p>}

      {/* Summary — each tile jumps to the matching queue filter */}
      <div className={styles.summary}>
        {summary.map((s) => {
          const body = (
            <>
              <span className={`${styles.summaryValue} ${s.tone ? styles[s.tone] : ''}`}>{s.value}</span>
              <span className={styles.summaryLabel}>{s.label}</span>
            </>
          )
          return s.view ? (
            <a key={s.label} href={`/my-work?view=${s.view}`} className={styles.summaryTile}>{body}</a>
          ) : (
            <div key={s.label} className={styles.summaryTile}>{body}</div>
          )
        })}
      </div>

      <div className="tabs">
        {WORK_VIEWS.map((v) => (
          <a
            key={v.key}
            href={v.key === 'active' ? '/my-work' : `/my-work?view=${v.key}`}
            className={`tab ${view === v.key ? 'tab-active' : ''}`}
          >
            {v.label}
            <span className={styles.tabCount}>{counts[v.key]}</span>
          </a>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">🔧</span>
            <span>
              {view === 'active'
                ? 'No devices are assigned to you. Claim one from the queue below to get started.'
                : `Nothing in "${WORK_VIEWS.find((v) => v.key === view)?.label}".`}
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.queue}>
          {visible.map((item) => {
            const due = describeDue(item.daysUntilDue)
            const pct = item.checklistTotal
              ? Math.round((item.checklistDone / item.checklistTotal) * 100)
              : 0

            return (
              <div key={item.id} className={`${styles.row} ${styles[`edge_${due.tone}`]}`}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTop}>
                    <div className={styles.identity}>
                      <a href={`/equipment/${item.id}`} className={styles.deviceName}>
                        {item.deviceName}
                      </a>
                      <span className={styles.internalId}>{item.internalId}</span>
                    </div>

                    <div className={styles.badges}>
                      <span className={`badge badge-${item.stage}`}>
                        {STAGE_LABELS[item.stage] ?? item.stage}
                      </span>
                      {item.subStatus && (
                        <span
                          className="badge"
                          style={
                            item.subStatus === 'blocked'
                              ? { background: 'var(--red-light)', color: 'var(--red)' }
                              : { background: 'var(--orange-light)', color: 'var(--orange)' }
                          }
                        >
                          {SUB_STATUS_LABELS[item.subStatus] ?? item.subStatus}
                        </span>
                      )}
                      {item.condition && (
                        <span className={`badge badge-${item.condition}`}>
                          {COSMETIC_CONDITION_LABELS[item.condition as CosmeticCondition] ?? item.condition}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.meta}>
                    {item.typeName && <span>{item.typeName}</span>}
                    <span className={`${styles.due} ${styles[due.tone]}`}>
                      {due.tone === 'overdue' && '⚠ '}
                      {due.label}
                      {item.dueDate && due.tone !== 'none' && (
                        <span className={styles.dueDate}> ({formatDate(item.dueDate)})</span>
                      )}
                    </span>
                    {item.destName && <span>→ {item.destName}</span>}
                    {item.openThreads > 0 && (
                      <a href="/support" className={styles.threadLink}>
                        💬 {item.openThreads} open thread{item.openThreads !== 1 ? 's' : ''}
                      </a>
                    )}
                  </div>

                  {item.checklistTotal > 0 && (
                    <div className={styles.progress}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${pct}%`,
                            background: pct === 100 ? 'var(--green)' : STAGE_COLORS[item.stage],
                          }}
                        />
                      </div>
                      <span className={styles.progressText}>
                        QA {item.checklistDone}/{item.checklistTotal}
                      </span>
                    </div>
                  )}
                </div>

                <RowActions
                  equipmentId={item.id}
                  stage={item.stage}
                  subStatus={item.subStatus}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Shared queue — anything in the org nobody has picked up yet */}
      <div className={styles.claimSection}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Unassigned queue</span>
            <a href="/equipment?tech=none" className="table-link" style={{ fontSize: 13 }}>
              View all
            </a>
          </div>
          {claimable.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <span>Every active device has a technician. Nice.</span>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Type</th>
                    <th>Stage</th>
                    <th>Due</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {claimable.map((c) => {
                    const due = describeDue(c.daysUntilDue)
                    return (
                      <tr key={c.id}>
                        <td>
                          <a href={`/equipment/${c.id}`} className="table-link">{c.deviceName}</a>
                          <div className="table-muted" style={{ fontSize: 12 }}>{c.internalId}</div>
                        </td>
                        <td className="table-muted">{c.typeName ?? '—'}</td>
                        <td>
                          <span className={`badge badge-${c.stage}`}>
                            {STAGE_LABELS[c.stage] ?? c.stage}
                          </span>
                        </td>
                        <td className={`table-muted ${styles[due.tone]}`}>{due.label}</td>
                        <td style={{ textAlign: 'right' }}>
                          <ClaimButton equipmentId={c.id} />
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
