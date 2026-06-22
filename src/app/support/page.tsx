import { createClient } from '@/utils/supabase/server'
import type { SupportThreadStatus } from '@/lib/types'

const STATUS_FILTER = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'awaiting_recipient', label: 'Awaiting Recipient' },
  { key: 'awaiting_tech', label: 'Awaiting Tech' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
]

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('support_threads')
    .select(`
      id, subject, status, opened_at, closed_at,
      equipment:equipment!equipment_id ( id, internal_id, make, model )
    `)
    .order('opened_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data: threads, error } = await query

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Support Threads</h1>
          <p className="page-subtitle">{threads?.length ?? 0} thread{threads?.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="tabs">
        {STATUS_FILTER.map((s) => (
          <a
            key={s.key}
            href={s.key ? `/support?status=${s.key}` : '/support'}
            className={`tab ${(status ?? '') === s.key ? 'tab-active' : ''}`}
          >
            {s.label}
          </a>
        ))}
      </div>

      <div className="card">
        {error && <p className="form-error" style={{ margin: '1rem' }}>{error.message}</p>}

        {!threads?.length ? (
          <div className="empty-state">
            <span className="empty-icon">💬</span>
            <span>No support threads found.</span>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Equipment</th>
                  <th>Status</th>
                  <th>Opened</th>
                </tr>
              </thead>
              <tbody>
                {threads.map((t) => {
                  const equip = t.equipment as unknown as { id: string; internal_id: string; make: string | null; model: string | null } | null
                  return (
                    <tr key={t.id}>
                      <td>
                        <a href={`/support/${t.id}`} className="table-link">{t.subject}</a>
                      </td>
                      <td>
                        {equip ? (
                          <a href={`/equipment/${equip.id}`} className="table-link">
                            {equip.internal_id}
                            {(equip.make || equip.model) && (
                              <span className="table-muted"> · {[equip.make, equip.model].filter(Boolean).join(' ')}</span>
                            )}
                          </a>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`badge badge-${t.status as SupportThreadStatus}`}>
                          {t.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="table-muted">
                        {new Date(t.opened_at).toLocaleDateString()}
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
