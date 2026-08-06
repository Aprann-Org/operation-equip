import {
  byUrgency,
  describeDue,
  matchesView,
  type WorkItem,
} from './my-work/work-queue'
import { STAGE_COLORS, STAGE_LABELS, SUB_STATUS_LABELS } from '@/lib/types'
import styles from './MyWorkPanel.module.css'

/** How many of the most urgent devices to preview before linking out. */
const PREVIEW_LIMIT = 4

/**
 * Dashboard entry point into /my-work: the technician's most urgent devices,
 * so the bench is visible without a click.
 */
export function MyWorkPanel({ items }: { items: WorkItem[] }) {
  const active = items.filter((i) => matchesView(i, 'active')).sort(byUrgency)
  const overdue = active.filter((i) => i.daysUntilDue !== null && i.daysUntilDue <= 0).length
  const blocked = active.filter((i) => i.subStatus === 'blocked').length
  const preview = active.slice(0, PREVIEW_LIMIT)
  const remaining = active.length - preview.length

  return (
    <section className={`${styles.panel} ${overdue > 0 ? styles.urgent : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>🔧 My Work</span>
          <span className={styles.summary}>
            {active.length === 0
              ? 'Nothing assigned to you'
              : `${active.length} device${active.length !== 1 ? 's' : ''} on your bench` +
                (blocked ? ` · ${blocked} blocked` : '')}
          </span>
          {overdue > 0 && (
            <span className={styles.overdueChip}>{overdue} overdue</span>
          )}
        </div>
        <a href="/my-work" className="btn btn-primary btn-sm">Open my work queue →</a>
      </div>

      {preview.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>✅</span>
          <span>Your bench is clear. Claim a device from the unassigned queue to pick up work.</span>
          <a href="/my-work" className="btn btn-secondary btn-sm">View unassigned queue</a>
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {preview.map((item) => {
              const due = describeDue(item.daysUntilDue)
              const pct = item.checklistTotal
                ? Math.round((item.checklistDone / item.checklistTotal) * 100)
                : 0

              return (
                <a
                  key={item.id}
                  href={`/equipment/${item.id}`}
                  className={`${styles.item} ${styles[`edge_${due.tone}`] ?? ''}`}
                >
                  <div className={styles.itemMain}>
                    <div className={styles.itemTop}>
                      <span className={styles.deviceName}>{item.deviceName}</span>
                      <span className={styles.internalId}>{item.internalId}</span>
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
                    </div>
                    <div className={styles.itemMeta}>
                      <span className={`${styles.due} ${styles[due.tone]}`}>
                        {due.tone === 'overdue' && '⚠ '}
                        {due.label}
                      </span>
                      {item.destName && <span>→ {item.destName}</span>}
                      {item.openThreads > 0 && (
                        <span>💬 {item.openThreads} open</span>
                      )}
                    </div>
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
                        {item.checklistDone}/{item.checklistTotal}
                      </span>
                    </div>
                  )}

                  <span className={styles.chevron}>›</span>
                </a>
              )
            })}
          </div>

          <div className={styles.footer}>
            <span className={styles.footerNote}>
              {remaining > 0
                ? `${remaining} more device${remaining !== 1 ? 's' : ''} in your queue`
                : 'Sorted by due date — most urgent first'}
            </span>
            <a href="/my-work" className="table-link" style={{ fontSize: 13 }}>
              View all {active.length} →
            </a>
          </div>
        </>
      )}
    </section>
  )
}
