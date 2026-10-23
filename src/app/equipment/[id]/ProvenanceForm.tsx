'use client'

import { useActionState, useRef, useState } from 'react'
import { updateProvenance } from './actions'
import styles from './HardwareForm.module.css'

type Org = { id: string; name: string }

type Props = {
  equipmentId: string
  donorOrganizationId: string | null
  sourceDetail: string | null
  sponsorName: string | null
  sponsorEmail: string | null
  donorOrgs: Org[]
}

export function ProvenanceForm({
  equipmentId,
  donorOrganizationId,
  sourceDetail,
  sponsorName,
  sponsorEmail,
  donorOrgs,
}: Props) {
  const [open, setOpen] = useState(false)
  // See HardwareForm: Cancel hides the last result, the next submit shows it again.
  const [dismissed, setDismissed] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState(
    async (prev: { error: string | null; message: string | null }, formData: FormData) => {
      setDismissed(false)
      const result = await updateProvenance(prev, formData)
      if (!result.error) setOpen(false)
      return result
    },
    { error: null, message: null }
  )

  function cancel() {
    formRef.current?.reset()
    setDismissed(true)
    setOpen(false)
  }

  // Remount the inputs when the stored values change (see HardwareForm).
  const savedValues = JSON.stringify([donorOrganizationId, sourceDetail, sponsorName, sponsorEmail])

  return (
    <>
      {state.message && !dismissed && (
        <p className={styles.success} aria-live="polite">{state.message}</p>
      )}

      <details
        className={styles.editSection}
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
      >
        <summary className={styles.editSummary}>Edit Provenance</summary>
        <form key={savedValues} ref={formRef} action={formAction} className={styles.form}>
          <input type="hidden" name="equipment_id" value={equipmentId} />
          {state.error && !dismissed && <p className="form-error">{state.error}</p>}

          <p className="field-hint" style={{ marginTop: 0, marginBottom: '1rem' }}>
            Clearing a field empties it — every value here is saved as shown.
          </p>

          <div className="form-grid">
            <div className="field">
              <label className="label" htmlFor="prov-donor">Donor Organization</label>
              <select id="prov-donor" name="donor_organization_id" defaultValue={donorOrganizationId ?? ''} className="select">
                <option value="">None / Unknown</option>
                {donorOrgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="prov-source">Source Detail</label>
              <input id="prov-source" name="source_detail" maxLength={500} defaultValue={sourceDetail ?? ''} className="input" placeholder="e.g. Corporate donation Q1 2026" />
            </div>
            <div className="field">
              <label className="label" htmlFor="prov-sponsor_name">Sponsor Name</label>
              <input id="prov-sponsor_name" name="sponsor_name" maxLength={200} defaultValue={sponsorName ?? ''} className="input" placeholder="Individual or company sponsor" />
            </div>
            <div className="field">
              <label className="label" htmlFor="prov-sponsor_email">Sponsor Email</label>
              <input id="prov-sponsor_email" name="sponsor_email" type="email" maxLength={320} defaultValue={sponsorEmail ?? ''} className="input" placeholder="Optional — requires a name" />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="prov-reason">Reason for Change</label>
            <input id="prov-reason" name="reason" className="input" placeholder="e.g. Donor confirmed on receipt paperwork" />
            <p className="field-hint">Saved with the change history. Optional, but worth filling in.</p>
          </div>

          <div className={styles.actions}>
            <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
              {isPending ? 'Saving…' : 'Save Provenance'}
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
