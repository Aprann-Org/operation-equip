'use client'

import { useActionState, useRef } from 'react'
import { addNote } from './actions'
import type { EquipmentNote } from '@/lib/types'
import styles from './NotesPanel.module.css'

type Props = {
  equipmentId: string
  notes: EquipmentNote[]
}

export function NotesPanel({ equipmentId, notes }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const result = await addNote(formData)
      if (!result.error) formRef.current?.reset()
      return result
    },
    {}
  )

  return (
    <div className={styles.panel}>
      <form ref={formRef} action={formAction} className={styles.form}>
        <input type="hidden" name="equipment_id" value={equipmentId} />
        <textarea
          name="note"
          className="textarea"
          rows={2}
          placeholder="Add an internal note…"
          required
        />
        <div className={styles.formFooter}>
          <select name="visibility" className="select" style={{ width: 'auto' }}>
            <option value="internal">Internal only</option>
            <option value="recipient_visible">Visible to recipient</option>
          </select>
          <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
            {isPending ? 'Saving…' : 'Add Note'}
          </button>
        </div>
        {state.error && <p className="form-error">{state.error}</p>}
      </form>

      {notes.length === 0 ? (
        <p className={styles.empty}>No notes yet.</p>
      ) : (
        <div className={styles.notes}>
          {notes.map((n) => (
            <div key={n.id} className={styles.note}>
              <div className={styles.noteMeta}>
                <span className={styles.noteAuthor}>
                  {n.user
                    ? `${n.user.first_name} ${n.user.last_name}`.trim() || n.user.email
                    : 'Unknown'}
                </span>
                <span className={styles.noteDate}>
                  {new Date(n.created_at).toLocaleString()}
                </span>
                {n.visibility === 'recipient_visible' && (
                  <span className="badge badge-recipient" style={{ fontSize: 10, padding: '2px 6px' }}>
                    Visible to recipient
                  </span>
                )}
              </div>
              <p className={styles.noteBody}>{n.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
