import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth'
import { STAGE_LABELS, type EquipmentStage } from '@/lib/types'
import { confirmDelivery, openSupportThread } from './actions'
import styles from './page.module.css'

export const metadata = { title: 'My Equipment — Operation Equip' }

export default async function MyEquipmentPage() {
  const ctx = await getCurrentUserContext()
  if (!ctx) redirect('/login')

  const supabase = await createClient()

  // Fetch equipment assigned to this person OR their organization
  const queries = [
    supabase
      .from('equipment')
      .select(`
        id, internal_id, make, model, stage, date_acquired, date_sent, date_delivered,
        cosmetic_condition, specs,
        equipment_type:equipment_types!equipment_type_id ( name ),
        support_threads ( id, subject, status )
      `)
      .eq('destination_person_id', ctx.userId)
      .neq('stage', 'retired'),
  ]

  if (ctx.organizationId) {
    queries.push(
      supabase
        .from('equipment')
        .select(`
          id, internal_id, make, model, stage, date_acquired, date_sent, date_delivered,
          cosmetic_condition, specs,
          equipment_type:equipment_types!equipment_type_id ( name ),
          support_threads ( id, subject, status )
        `)
        .eq('destination_organization_id', ctx.organizationId)
        .is('destination_person_id', null)
        .neq('stage', 'retired')
    )
  }

  const results = await Promise.all(queries)
  const seen = new Set<string>()
  const equipment = results
    .flatMap(r => r.data ?? [])
    .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
    .sort((a, b) => new Date(b.date_acquired ?? 0).getTime() - new Date(a.date_acquired ?? 0).getTime())

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Equipment</h1>
        <p className={styles.subtitle}>
          {equipment.length === 0
            ? 'No devices have been assigned to you yet.'
            : `${equipment.length} device${equipment.length !== 1 ? 's' : ''} assigned to you`}
        </p>
      </div>

      {equipment.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <span>Your equipment will appear here once it has been assigned.</span>
        </div>
      ) : (
        <div className={styles.cards}>
          {equipment.map((e) => {
            const typeName = (e.equipment_type as unknown as { name: string } | null)?.name
            const stage = e.stage as EquipmentStage
            const threads = (e.support_threads ?? []) as { id: string; subject: string; status: string }[]
            const openThreads = threads.filter(t => t.status !== 'closed' && t.status !== 'resolved')
            const deviceName = [e.make, e.model].filter(Boolean).join(' ') || e.internal_id

            return (
              <div key={e.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <p className={styles.deviceName}>{deviceName}</p>
                    <p className={styles.deviceMeta}>
                      {typeName && <span>{typeName}</span>}
                      <span className={styles.deviceId}>{e.internal_id}</span>
                    </p>
                  </div>
                  <span className={`badge badge-${stage}`}>{STAGE_LABELS[stage] ?? stage}</span>
                </div>

                <dl className={styles.specs}>
                  {e.specs?.os && <><dt>OS</dt><dd>{String(e.specs.os)}</dd></>}
                  {e.cosmetic_condition && (
                    <><dt>Condition</dt><dd><span className={`badge badge-${e.cosmetic_condition}`}>{e.cosmetic_condition}</span></dd></>
                  )}
                  {e.date_sent && (
                    <><dt>Shipped</dt><dd>{new Date(e.date_sent).toLocaleDateString()}</dd></>
                  )}
                  {e.date_delivered && (
                    <><dt>Delivered</dt><dd>{new Date(e.date_delivered).toLocaleDateString()}</dd></>
                  )}
                </dl>

                <div className={styles.cardActions}>
                  {/* Confirm delivery if shipped but not yet confirmed */}
                  {stage === 'distributed' && !e.date_delivered && (
                    <form action={confirmDelivery}>
                      <input type="hidden" name="equipment_id" value={e.id} />
                      <button type="submit" className="btn btn-primary btn-sm">
                        Confirm Delivery
                      </button>
                    </form>
                  )}

                  {/* Open support thread */}
                  <details className={styles.supportDetails}>
                    <summary className={styles.supportSummary}>
                      Get Help
                      {openThreads.length > 0 && (
                        <span className={styles.threadBadge}>{openThreads.length} open</span>
                      )}
                    </summary>

                    {openThreads.length > 0 && (
                      <div className={styles.threads}>
                        {openThreads.map(t => (
                          <a key={t.id} href={`/support/${t.id}`} className={styles.threadLink}>
                            {t.subject}
                            <span className={`badge badge-${t.status}`}>{t.status.replace(/_/g, ' ')}</span>
                          </a>
                        ))}
                      </div>
                    )}

                    <form action={openSupportThread} className={styles.supportForm}>
                      <input type="hidden" name="equipment_id" value={e.id} />
                      <input
                        name="subject"
                        className="input"
                        placeholder="Describe the issue briefly…"
                        required
                      />
                      <button type="submit" className="btn btn-secondary btn-sm">
                        Open New Thread
                      </button>
                    </form>
                  </details>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
