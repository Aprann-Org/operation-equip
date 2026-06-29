'use client'

import { useActionState } from 'react'
import { saveChecklistResult } from './actions'
import type { ChecklistItem, ChecklistResult } from '@/lib/types'
import styles from './ChecklistPanel.module.css'

type Props = {
  equipmentId: string
  items: ChecklistItem[]
  results: ChecklistResult[]
}

export function ChecklistPanel({ equipmentId, items, results }: Props) {
  const resultMap = new Map(results.map((r) => [r.checklist_item_id, r]))
  const completed = results.length
  const total = items.length

  if (!items.length) {
    return (
      <div className="empty-state" style={{ padding: '1.5rem' }}>
        <span>No checklist template for this equipment type.</span>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.progress}>
        <span className={styles.progressText}>{completed}/{total} completed</span>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: total ? `${(completed / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      <div className={styles.items}>
        {items.map((item) => {
          const result = resultMap.get(item.id)
          return (
            <ChecklistItemRow
              key={item.id}
              equipmentId={equipmentId}
              item={item}
              result={result}
            />
          )
        })}
      </div>
    </div>
  )
}

function ChecklistItemRow({
  equipmentId,
  item,
  result,
}: {
  equipmentId: string
  item: ChecklistItem
  result?: ChecklistResult
}) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => saveChecklistResult(formData),
    {}
  )

  const isDone = !!result

  return (
    <div className={`${styles.item} ${isDone ? styles.done : ''}`}>
      <div className={styles.itemHeader}>
        <span className={styles.itemCheck}>{isDone ? '✓' : '○'}</span>
        <div className={styles.itemInfo}>
          <span className={styles.itemLabel}>{item.order}. {item.label}</span>
          {item.help_text && <span className={styles.itemHint}>{item.help_text}</span>}
        </div>
      </div>

      {!isDone && (
        <form action={formAction} className={styles.itemForm}>
          <input type="hidden" name="equipment_id" value={equipmentId} />
          <input type="hidden" name="checklist_item_id" value={item.id} />
          <input type="hidden" name="result_type" value={item.result_type} />

          {item.result_type === 'boolean' && (
            <div className={styles.boolButtons}>
              <button
                type="submit"
                name="result_boolean"
                value="true"
                disabled={isPending}
                className={`btn btn-sm ${styles.passBtn}`}
              >
                Pass
              </button>
              <button
                type="submit"
                name="result_boolean"
                value="false"
                disabled={isPending}
                className={`btn btn-sm ${styles.failBtn}`}
              >
                Fail
              </button>
            </div>
          )}

          {item.result_type === 'text' && (
            <div className={styles.textInput}>
              <textarea name="result_text" className="textarea" rows={2} placeholder="Enter result…" required />
              <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
                Save
              </button>
            </div>
          )}

          {item.result_type === 'numeric' && (
            <div className={styles.numInput}>
              <input name="result_numeric" type="number" step="any" className="input" style={{ maxWidth: 140 }} required />
              <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
                Save
              </button>
            </div>
          )}

          {state.error && <p className="form-error" style={{ marginTop: 4 }}>{state.error}</p>}
        </form>
      )}

      {isDone && result && (
        <div className={styles.resultValue}>
          {item.result_type === 'boolean' && (
            <span className={result.result_boolean ? styles.pass : styles.fail}>
              {result.result_boolean ? '✓ Pass' : '✗ Fail'}
            </span>
          )}
          {item.result_type === 'text' && <span className={styles.textResult}>{result.result_text}</span>}
          {item.result_type === 'numeric' && <span className={styles.textResult}>{result.result_numeric}</span>}
        </div>
      )}
    </div>
  )
}
