'use client'

import { useActionState, useRef } from 'react'
import { replyToThread, updateThreadStatus } from './actions'
import type { SupportThreadStatus } from '@/lib/types'
import styles from './ReplyForm.module.css'

const NEXT_STATUSES: { value: SupportThreadStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'awaiting_recipient', label: 'Awaiting Recipient' },
  { value: 'awaiting_tech', label: 'Awaiting Tech' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

type Props = {
  threadId: string
  currentStatus: SupportThreadStatus
}

export function ReplyForm({ threadId, currentStatus }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  const [replyState, replyAction, replyPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const result = await replyToThread(formData)
      if (!result.error) formRef.current?.reset()
      return result
    },
    {}
  )

  const [statusState, statusAction, statusPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => updateThreadStatus(formData),
    {}
  )

  return (
    <div className={styles.wrapper}>
      {/* Reply form */}
      <form ref={formRef} action={replyAction} className={styles.replyForm}>
        <input type="hidden" name="thread_id" value={threadId} />
        <textarea
          name="body"
          className="textarea"
          rows={3}
          placeholder="Write a reply…"
          required
        />
        {replyState.error && <p className="form-error">{replyState.error}</p>}
        <div className={styles.replyFooter}>
          <button type="submit" disabled={replyPending} className="btn btn-primary">
            {replyPending ? 'Sending…' : 'Send Reply'}
          </button>
        </div>
      </form>

      {/* Status update */}
      <form action={statusAction} className={styles.statusForm}>
        <input type="hidden" name="thread_id" value={threadId} />
        <label className="label">Update Status</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select name="status" defaultValue={currentStatus} className="select" style={{ width: 'auto' }}>
            {NEXT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button type="submit" disabled={statusPending} className="btn btn-secondary btn-sm">
            {statusPending ? 'Updating…' : 'Update'}
          </button>
        </div>
        {statusState.error && <p className="form-error">{statusState.error}</p>}
      </form>
    </div>
  )
}
