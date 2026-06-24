import type React from 'react'
import { createClient } from '@/utils/supabase/server'
import { STAGE_ORDER, STAGE_LABELS, STAGE_COLORS } from '@/lib/types'
import styles from './page.module.css'

async function getStats() {
  const supabase = await createClient()

  const [orgResult, equipResult, shipmentsResult] = await Promise.all([
    supabase.from('organizations').select('id', { count: 'exact', head: true }),
    supabase.from('equipment').select('stage'),
    supabase
      .from('equipment')
      .select(`
        id, internal_id, make, model, date_sent,
        destination_org:organizations!destination_organization_id ( name )
      `)
      .eq('stage', 'distributed')
      .order('date_sent', { ascending: false })
      .limit(5),
  ])

  const stageCounts: Record<string, number> = {}
  for (const row of equipResult.data ?? []) {
    stageCounts[row.stage] = (stageCounts[row.stage] ?? 0) + 1
  }

  return {
    orgCount: orgResult.count ?? 0,
    stageCounts,
    totalEquipment: (equipResult.data ?? []).length,
    totalDistributed: stageCounts['distributed'] ?? 0,
    totalInProcess: stageCounts['in_process'] ?? 0,
    totalReady: stageCounts['ready_for_distribution'] ?? 0,
    recentShipments: shipmentsResult.data ?? [],
  }
}

export default async function DashboardPage() {
  const stats = await getStats()
  const pipelineTotal = STAGE_ORDER.reduce((sum, s) => sum + (stats.stageCounts[s] ?? 0), 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.greeting}>Dashboard</h1>
            <p className={styles.subtitle}>Track every device from acquisition to delivery.</p>
          </div>
          <a href="/equipment/new" className="btn btn-primary">
            + Add Equipment
          </a>
        </div>
      </div>

      <main className={styles.main}>
        {/* Stats */}
        <section>
          <p className="section-label">Overview</p>
          <div className={styles.statsGrid}>
            {[
              { icon: '📦', value: stats.totalEquipment, label: 'Total Equipment', color: '#15a87e' },
              { icon: '✅', value: stats.totalDistributed, label: 'Distributed', color: '#16a34a' },
              { icon: '⚙️', value: stats.totalInProcess, label: 'In Process', color: '#d97706' },
              { icon: '🏢', value: stats.orgCount, label: 'Organizations', color: '#4b9fcf' },
            ].map((s) => (
              <div
                key={s.label}
                className={styles.statCard}
                style={{ '--card-accent': s.color } as React.CSSProperties}
              >
                <span
                  className={styles.statIcon}
                  style={{ background: `${s.color}20` }}
                >
                  {s.icon}
                </span>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline */}
        <section>
          <p className="section-label">Equipment Pipeline</p>
          <div className={styles.pipeline}>
            {pipelineTotal > 0 && (
              <div className={styles.pipelineSummaryBar}>
                {STAGE_ORDER.map((stage) => {
                  const count = stats.stageCounts[stage] ?? 0
                  if (count === 0) return null
                  return (
                    <span
                      key={stage}
                      className={styles.pipelineSummarySegment}
                      style={{
                        width: `${(count / pipelineTotal) * 100}%`,
                        background: STAGE_COLORS[stage],
                      }}
                    />
                  )
                })}
              </div>
            )}
            <div className={styles.pipelineStages}>
              {STAGE_ORDER.map((stage) => (
                <a
                  key={stage}
                  href={`/equipment?stage=${stage}`}
                  className={styles.pipelineStage}
                  style={{ '--stage-color': STAGE_COLORS[stage] } as React.CSSProperties}
                >
                  <span className={styles.stageName}>{STAGE_LABELS[stage]}</span>
                  <span className={styles.stageCount}>
                    {stats.stageCounts[stage] ?? 0}
                  </span>
                  <span className={styles.stageBar} />
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom grid */}
        <div className={styles.bottomGrid}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Shipments</span>
              <a href="/equipment?stage=distributed" className="table-link" style={{ fontSize: 13 }}>
                View all
              </a>
            </div>
            {stats.recentShipments.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📤</span>
                <span>No distributed equipment yet.</span>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>Device</th><th>Recipient</th><th>Sent</th></tr>
                  </thead>
                  <tbody>
                    {stats.recentShipments.map((e) => {
                      const dest = (e.destination_org as { name: string }[] | null)?.[0]?.name
                      return (
                        <tr key={e.id}>
                          <td>
                            <a href={`/equipment/${e.id}`} className="table-link">
                              {e.internal_id}
                            </a>
                            {(e.make || e.model) && (
                              <div className="table-muted" style={{ fontSize: 12 }}>
                                {[e.make, e.model].filter(Boolean).join(' ')}
                              </div>
                            )}
                          </td>
                          <td className="table-muted">{dest ?? '—'}</td>
                          <td className="table-muted">
                            {e.date_sent ? new Date(e.date_sent).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Quick Actions</span>
            </div>
            <div className={styles.quickActions}>
              {[
                { icon: '➕', label: 'Add new equipment', href: '/equipment/new' },
                { icon: '🏢', label: 'Manage organizations', href: '/organizations' },
                {
                  icon: '📋',
                  label: `View ready-to-ship (${stats.totalReady})`,
                  href: '/equipment?stage=ready_for_distribution',
                },
                { icon: '💬', label: 'Support threads', href: '/support' },
              ].map((a) => (
                <a key={a.href} href={a.href} className={styles.actionRow}>
                  <span className={styles.actionIcon}>{a.icon}</span>
                  {a.label}
                  <span className={styles.actionArrow}>›</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
