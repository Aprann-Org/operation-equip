'use client'

import { useActionState, useState } from 'react'
import { changeStage, changeSubStatus } from './actions'
import { STAGE_ORDER, STAGE_LABELS, STAGE_COLORS, type EquipmentStage, type EquipmentSubStatus } from '@/lib/types'
import styles from './StagePanel.module.css'

const RETIREMENT_REASONS = [
  { value: 'lost', label: 'Lost' },
  { value: 'broken', label: 'Broken beyond repair' },
  { value: 'returned_to_donor', label: 'Returned to donor' },
  { value: 'end_of_life', label: 'End of life' },
  { value: 'other', label: 'Other' },
]

const SUB_STATUSES = [
  { value: '', label: 'None' },
  { value: 'testing', label: 'Testing' },
  { value: 'repairing', label: 'Repairing' },
  { value: 'awaiting_parts', label: 'Awaiting Parts' },
  { value: 'awaiting_software', label: 'Awaiting Software' },
  { value: 'final_qa', label: 'Final QA' },
  { value: 'blocked', label: 'Blocked' },
]

type Props = {
  equipmentId: string
  currentStage: EquipmentStage
  currentSubStatus: EquipmentSubStatus | null
}

export function StagePanel({ equipmentId, currentStage, currentSubStatus }: Props) {
  const [confirmRetire, setConfirmRetire] = useState(false)

  const [stageState, stageAction, stagePending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => changeStage(formData),
    {}
  )

  const [retireState, retireAction, retirePending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const result = await changeStage(formData)
      if (!result.error) setConfirmRetire(false)
      return result
    },
    {}
  )

  const [subState, subAction, subPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => changeSubStatus(formData),
    {}
  )

  const currentIdx = STAGE_ORDER.indexOf(currentStage)

  return (
    <div className={styles.panel}>
      {stageState.error && <p className="form-error">{stageState.error}</p>}

      <p className="section-label">Pipeline</p>
      <div className={styles.pipeline}>
        {STAGE_ORDER.map((stage) => {
          const isCurrent = stage === currentStage
          const isNext = STAGE_ORDER.indexOf(stage) === currentIdx + 1
          return (
            <form key={stage} action={stageAction}>
              <input type="hidden" name="equipment_id" value={equipmentId} />
              <input type="hidden" name="new_stage" value={stage} />
              <button
                type="submit"
                disabled={isCurrent || stagePending}
                className={`${styles.stageBtn} ${isCurrent ? styles.current : ''} ${isNext ? styles.next : ''}`}
                style={{ borderColor: isCurrent ? STAGE_COLORS[stage] : undefined }}
              >
                <span className={styles.dot} style={{ background: STAGE_COLORS[stage] }} />
                {STAGE_LABELS[stage]}
                {isCurrent && <span className={styles.currentLabel}>Current</span>}
              </button>
            </form>
          )
        })}
      </div>

      {/* In Support button — only shows when distributed */}
      {currentStage === 'distributed' && (
        <>
          <hr className="divider" />
          <form action={stageAction}>
            <input type="hidden" name="equipment_id" value={equipmentId} />
            <input type="hidden" name="new_stage" value="in_support" />
            <button type="submit" disabled={stagePending} className={`${styles.stageBtn} ${styles.next}`} style={{ width: '100%' }}>
              <span className={styles.dot} style={{ background: STAGE_COLORS['in_support'] }} />
              {STAGE_LABELS['in_support']}
            </button>
          </form>
        </>
      )}

      {/* Sub-status — only when in_process */}
      {currentStage === 'in_process' && (
        <>
          <hr className="divider" />
          <p className="section-label">Refurbishment Status</p>
          {subState.error && <p className="form-error">{subState.error}</p>}
          <form action={subAction} className={styles.subStatusForm}>
            <input type="hidden" name="equipment_id" value={equipmentId} />
            <select name="sub_status" defaultValue={currentSubStatus ?? ''} className="select">
              {SUB_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button type="submit" disabled={subPending} className="btn btn-secondary btn-sm">
              {subPending ? '…' : 'Set'}
            </button>
          </form>
        </>
      )}

      {/* Retirement — show on any non-retired stage */}
      {currentStage !== 'retired' && (
        <>
          <hr className="divider" />
          {!confirmRetire ? (
            <button
              type="button"
              onClick={() => setConfirmRetire(true)}
              className={`btn btn-danger btn-sm ${styles.retireToggle}`}
            >
              Retire Device
            </button>
          ) : (
            <div className={styles.retireBox}>
              <p className={styles.retireTitle}>Retire this device</p>
              {retireState.error && <p className="form-error">{retireState.error}</p>}
              <form action={retireAction} className={styles.retireFields}>
                <input type="hidden" name="equipment_id" value={equipmentId} />
                <input type="hidden" name="new_stage" value="retired" />
                <div className="field">
                  <label className="label">Reason *</label>
                  <select name="retirement_reason" required className="select">
                    <option value="">Select reason…</option>
                    {RETIREMENT_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Notes</label>
                  <textarea name="retirement_notes" className="textarea" rows={2} placeholder="Any additional details…" />
                </div>
                <div className={styles.retireBtns}>
                  <button type="submit" disabled={retirePending} className="btn btn-danger btn-sm">
                    {retirePending ? 'Retiring…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRetire(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )
}
