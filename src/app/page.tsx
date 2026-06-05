import { createClient } from '@/utils/supabase/server'
import { STAGE_ORDER, STAGE_LABELS, STAGE_COLORS } from '@/lib/types'
import styles from './page.module.css'

async function getStats() {
  const supabase = await createClient()

  const [orgResult, equipResult] = await Promise.all([
    supabase.from('organizations').select('id', { count: 'exact', head: true }),
    supabase.from('equipment').select('stage'),
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
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

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
              { icon: '📦', value: stats.totalEquipment, label: 'Total Equipment' },
              { icon: '✅', value: stats.totalDistributed, label: 'Distributed' },
              { icon: '⚙️', value: stats.totalInProcess, label: 'In Process' },
              { icon: '🏢', value: stats.orgCount, label: 'Organizations' },
            ].map((s) => (
              <div key={s.label} className={styles.statCard}>
                <span className={styles.statIcon}>{s.icon}</span>
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
            {STAGE_ORDER.map((stage) => (
              <a
                key={stage}
                href={`/equipment?stage=${stage}`}
                className={styles.pipelineStage}
              >
                <span
                  className={styles.stageDot}
                  style={{ background: STAGE_COLORS[stage] }}
                />
                <span className={styles.stageName}>{STAGE_LABELS[stage]}</span>
                <span className={styles.stageCount}>
                  {stats.stageCounts[stage] ?? 0}
                </span>
              </a>
            ))}
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
            <div className="empty-state">
              <span className="empty-icon">📤</span>
              <span>Distributed equipment will appear here.</span>
            </div>
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
