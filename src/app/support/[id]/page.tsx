import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import type { SupportThreadStatus } from '@/lib/types'
import { ReplyForm } from './ReplyForm'
import styles from './page.module.css'

export default async function SupportThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: thread } = await supabase
    .from('support_threads')
    .select(`
      *,
      equipment:equipment!equipment_id ( id, internal_id, make, model ),
      messages:support_messages (
        id, body, sent_at,
        user:users!user_id ( first_name, last_name, email )
      )
    `)
    .eq('id', id)
    .single()

  if (!thread) notFound()

  const equip = thread.equipment as { id: string; internal_id: string; make: string | null; model: string | null } | null
  const messages = ((thread.messages ?? []) as {
    id: string
    body: string
    sent_at: string
    user: { first_name: string; last_name: string; email: string } | null
  }[]).sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())

  const status = thread.status as SupportThreadStatus

  return (
    <div className="page-container" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <div className={styles.breadcrumb}>
            <a href="/support" className="table-link">Support</a>
            <span className={styles.sep}>›</span>
            <span className={styles.subject}>{thread.subject}</span>
          </div>
          <h1 className="page-title">{thread.subject}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`badge badge-${status}`}>{status.replace(/_/g, ' ')}</span>
            {equip && (
              <a href={`/equipment/${equip.id}`} className="table-link" style={{ fontSize: 13 }}>
                {equip.internal_id}
                {(equip.make || equip.model) && ` · ${[equip.make, equip.model].filter(Boolean).join(' ')}`}
              </a>
            )}
            <span className="table-muted" style={{ fontSize: 12 }}>
              Opened {new Date(thread.opened_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <a href="/support" className="btn btn-secondary">← Back</a>
      </div>

      <div className={styles.layout}>
        {/* Messages */}
        <div className="card">
          <div className="card-header"><span className="card-title">Messages</span></div>
          <div className={styles.messages}>
            {messages.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem' }}>
                No messages yet.
              </div>
            ) : (
              messages.map((m) => {
                const author = m.user
                  ? `${m.user.first_name} ${m.user.last_name}`.trim() || m.user.email
                  : 'Unknown'
                return (
                  <div key={m.id} className={styles.message}>
                    <div className={styles.msgMeta}>
                      <span className={styles.msgAuthor}>{author}</span>
                      <span className={styles.msgDate}>{new Date(m.sent_at).toLocaleString()}</span>
                    </div>
                    <p className={styles.msgBody}>{m.body}</p>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Reply + status sidebar */}
        <div className={styles.sidebar}>
          <div className="card">
            <div className="card-header"><span className="card-title">Reply</span></div>
            <div className="card-body">
              <ReplyForm threadId={thread.id} currentStatus={status} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
