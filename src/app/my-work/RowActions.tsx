'use client'

import { useActionState } from 'react'
import { changeStage, changeSubStatus } from '@/app/equipment/[id]/actions'
import { claimDevice, releaseDevice } from './actions'
import {
  STAGE_LABELS,
  STAGE_ORDER,
  SUB_STATUSES,
  SUB_STATUS_LABELS,
  type EquipmentStage,
  type EquipmentSubStatus,
} from '@/lib/types'
import styles from './page.module.css'

type Props = {
  equipmentId: string
  stage: EquipmentStage
  subStatus: EquipmentSubStatus | null
}

/**
 * The two edits a technician makes most often — bump the refurb sub-status and
 * push the device to the next stage — without leaving the queue.
 */
export function RowActions({ equipmentId, stage, subStatus }: Props) {
  const [stageState, stageAction, stagePending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => changeStage(formData),
    {}
  )

  const [subState, subAction, subPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => changeSubStatus(formData),
    {}
  )

  const [releaseState, releaseAction, releasePending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => releaseDevice(formData),
    {}
  )

  const currentIdx = STAGE_ORDER.indexOf(stage)
  const nextStage =
    currentIdx >= 0 && currentIdx < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentIdx + 1] : null

  const error = stageState.error ?? subState.error ?? releaseState.error

  return (
    <div className={styles.actions}>
      {stage === 'in_process' && (
        <form action={subAction} className={styles.subStatusForm}>
          <input type="hidden" name="equipment_id" value={equipmentId} />
          <select
            name="sub_status"
            defaultValue={subStatus ?? ''}
            className={`select ${styles.subStatusSelect}`}
            aria-label="Refurbishment status"
          >
            <option value="">No sub-status</option>
            {SUB_STATUSES.map((s) => (
              <option key={s} value={s}>{SUB_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button type="submit" disabled={subPending} className="btn btn-secondary btn-sm">
            {subPending ? '…' : 'Set'}
          </button>
        </form>
      )}

      {nextStage && (
        <form action={stageAction}>
          <input type="hidden" name="equipment_id" value={equipmentId} />
          <input type="hidden" name="new_stage" value={nextStage} />
          <button type="submit" disabled={stagePending} className="btn btn-primary btn-sm">
            {stagePending ? 'Moving…' : `Move to ${STAGE_LABELS[nextStage]}`}
          </button>
        </form>
      )}

      <a href={`/equipment/${equipmentId}`} className="btn btn-secondary btn-sm">
        Open device
      </a>

      <form action={releaseAction} className={styles.releaseForm}>
        <input type="hidden" name="equipment_id" value={equipmentId} />
        <button type="submit" disabled={releasePending} className={styles.linkBtn}>
          {releasePending ? 'Releasing…' : 'Release'}
        </button>
      </form>

      {error && <p className={`form-error ${styles.actionError}`}>{error}</p>}
    </div>
  )
}

/** Take an unassigned device from the shared queue. */
export function ClaimButton({ equipmentId }: { equipmentId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => claimDevice(formData),
    {}
  )

  return (
    <form action={formAction} className={styles.claimForm}>
      <input type="hidden" name="equipment_id" value={equipmentId} />
      <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm">
        {isPending ? 'Claiming…' : 'Claim'}
      </button>
      {state.error && <span className={styles.claimError}>{state.error}</span>}
    </form>
  )
}
