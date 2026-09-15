'use client'

import { useActionState, useRef, useState } from 'react'
import { updateHardware } from './actions'
import { DISK_TYPES, DISK_TYPE_LABELS } from '@/lib/types'
import styles from './HardwareForm.module.css'

type Props = {
  equipmentId: string
  make: string | null
  model: string | null
  processor: string | null
  ramGb: number | null
  diskCapacityGb: number | null
  diskType: string | null
  screenSizeIn: number | null
  os: string | null
}

export function HardwareForm({
  equipmentId,
  make,
  model,
  processor,
  ramGb,
  diskCapacityGb,
  diskType,
  screenSizeIn,
  os,
}: Props) {
  const [open, setOpen] = useState(false)
  // Cancel leaves the last result behind in useActionState, which has no reset.
  // Hiding it is enough: the next submit clears the flag again.
  const [dismissed, setDismissed] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState(
    async (prev: { error: string | null; message: string | null }, formData: FormData) => {
      setDismissed(false)
      const result = await updateHardware(prev, formData)
      // Collapse on success; on an error the form stays open to be corrected.
      if (!result.error) setOpen(false)
      return result
    },
    { error: null, message: null }
  )

  /** Discard whatever was typed and collapse — reset() restores the defaultValues. */
  function cancel() {
    formRef.current?.reset()
    setDismissed(true)
    setOpen(false)
  }

  /**
   * defaultValue only applies on mount, so a saved edit would leave the inputs
   * showing what was typed rather than what the server stored. Keying the form
   * on the incoming values remounts the inputs whenever the page revalidates.
   */
  const savedValues = JSON.stringify([
    make, model, processor, ramGb, diskCapacityGb, diskType, screenSizeIn, os,
  ])

  return (
    <>
      {/* Outside the disclosure, so a successful save stays readable after it closes */}
      {state.message && !dismissed && (
        <p className={styles.success} aria-live="polite">{state.message}</p>
      )}

      <details
        className={styles.editSection}
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
      >
        <summary className={styles.editSummary}>Edit Hardware</summary>
        <form key={savedValues} ref={formRef} action={formAction} className={styles.form}>
          <input type="hidden" name="equipment_id" value={equipmentId} />
          {state.error && !dismissed && <p className="form-error">{state.error}</p>}

          <p className="field-hint" style={{ marginTop: 0, marginBottom: '1rem' }}>
            Clearing a field empties it — every value here is saved as shown.
          </p>

          <div className="form-grid">
            <div className="field">
              <label className="label" htmlFor="hw-make">Make</label>
              <input id="hw-make" name="make" defaultValue={make ?? ''} className="input" placeholder="e.g. Dell, Apple, HP" />
            </div>
            <div className="field">
              <label className="label" htmlFor="hw-model">Model</label>
              <input id="hw-model" name="model" defaultValue={model ?? ''} className="input" placeholder="e.g. Latitude 5490" />
            </div>
            <div className="field">
              <label className="label" htmlFor="hw-processor">Processor</label>
              <input id="hw-processor" name="processor" defaultValue={processor ?? ''} className="input" placeholder="e.g. Intel Core i5-8250U" />
            </div>
            <div className="field">
              <label className="label" htmlFor="hw-ram_gb">RAM (GB)</label>
              <input id="hw-ram_gb" name="ram_gb" type="number" min="1" max="512" defaultValue={ramGb ?? ''} className="input" placeholder="e.g. 8" />
            </div>
            <div className="field">
              <label className="label" htmlFor="hw-disk_capacity_gb">Disk Capacity (GB)</label>
              <input id="hw-disk_capacity_gb" name="disk_capacity_gb" type="number" min="1" defaultValue={diskCapacityGb ?? ''} className="input" placeholder="e.g. 256" />
            </div>
            <div className="field">
              <label className="label" htmlFor="hw-disk_type">Disk Type</label>
              <select id="hw-disk_type" name="disk_type" defaultValue={diskType ?? ''} className="select">
                <option value="">Select…</option>
                {DISK_TYPES.map((t) => (
                  <option key={t} value={t}>{DISK_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="hw-screen_size_in">Screen Size (inches)</label>
              <input id="hw-screen_size_in" name="screen_size_in" type="number" step="0.1" min="1" defaultValue={screenSizeIn ?? ''} className="input" placeholder="e.g. 13.3" />
            </div>
            <div className="field">
              <label className="label" htmlFor="hw-os">Operating System</label>
              <input id="hw-os" name="os" defaultValue={os ?? ''} className="input" placeholder="e.g. Windows 11 Pro" />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="hw-reason">Reason for Change</label>
            <input id="hw-reason" name="reason" className="input" placeholder="e.g. RAM upgraded to 16 GB during refurb" />
            <p className="field-hint">Saved with the change history. Optional, but worth filling in.</p>
          </div>

          <div className={styles.actions}>
            <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
              {isPending ? 'Saving…' : 'Save Hardware'}
            </button>
            <button type="button" onClick={cancel} disabled={isPending} className="btn btn-secondary btn-sm">
              Cancel
            </button>
          </div>
        </form>
      </details>
    </>
  )
}
