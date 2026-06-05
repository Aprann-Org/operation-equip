'use client'

import { useActionState, useRef } from 'react'
import { createBatteryReport } from './actions'
import styles from './BatteryPanel.module.css'

type BatteryReport = {
  id: string
  report_date: string
  design_capacity_mwh: number | null
  full_charge_capacity_mwh: number | null
  percent_of_design: number | null
  cycle_count: number | null
  estimated_runtime_minutes: number | null
  source: string
}

type Props = {
  equipmentId: string
  reports: BatteryReport[]
}

export function BatteryPanel({ equipmentId, reports }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error: string | null }, formData: FormData) => {
      const result = await createBatteryReport(_prev, formData)
      if (!result.error) formRef.current?.reset()
      return result
    },
    { error: null }
  )

  return (
    <div className={styles.panel}>
      {reports.length === 0 ? (
        <p className={styles.empty}>No battery reports yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Health</th>
                <th>Cycles</th>
                <th>Full Charge</th>
                <th>Design Cap.</th>
                <th>Est. Runtime</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="table-muted">{new Date(r.report_date).toLocaleDateString()}</td>
                  <td>
                    {r.percent_of_design != null ? (
                      <span className={healthClass(r.percent_of_design)}>
                        {r.percent_of_design}%
                      </span>
                    ) : <span className="table-muted">—</span>}
                  </td>
                  <td className="table-muted">{r.cycle_count ?? '—'}</td>
                  <td className="table-muted">
                    {r.full_charge_capacity_mwh != null ? `${r.full_charge_capacity_mwh} mWh` : '—'}
                  </td>
                  <td className="table-muted">
                    {r.design_capacity_mwh != null ? `${r.design_capacity_mwh} mWh` : '—'}
                  </td>
                  <td className="table-muted">
                    {r.estimated_runtime_minutes != null ? `${r.estimated_runtime_minutes} min` : '—'}
                  </td>
                  <td className="table-muted">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className={styles.addSection}>
        <summary className={styles.addSummary}>+ Add Battery Report</summary>
        <form ref={formRef} action={formAction} className={styles.form}>
          <input type="hidden" name="equipment_id" value={equipmentId} />
          {state.error && <p className="form-error">{state.error}</p>}
          <div className="form-grid">
            <div className="field">
              <label className="label">Report Date *</label>
              <input name="report_date" type="date" required className="input" />
            </div>
            <div className="field">
              <label className="label">Source *</label>
              <select name="source" required className="select">
                <option value="powercfg">powercfg (Windows)</option>
                <option value="apple_system_info">Apple System Info</option>
                <option value="manual">Manual measurement</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Design Capacity (mWh)</label>
              <input name="design_capacity_mwh" type="number" min="0" className="input" placeholder="e.g. 41400" />
            </div>
            <div className="field">
              <label className="label">Full Charge Capacity (mWh)</label>
              <input name="full_charge_capacity_mwh" type="number" min="0" className="input" placeholder="e.g. 35200" />
              <p className="field-hint">Health % is calculated automatically.</p>
            </div>
            <div className="field">
              <label className="label">Cycle Count</label>
              <input name="cycle_count" type="number" min="0" className="input" placeholder="e.g. 312" />
            </div>
            <div className="field">
              <label className="label">Estimated Runtime (minutes)</label>
              <input name="estimated_runtime_minutes" type="number" min="0" className="input" placeholder="e.g. 180" />
            </div>
          </div>
          <div className="field">
            <label className="label">Raw Report URL</label>
            <input name="raw_report_url" type="url" className="input" placeholder="https://…" />
          </div>
          <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
            {isPending ? 'Saving…' : 'Save Report'}
          </button>
        </form>
      </details>
    </div>
  )
}

function healthClass(pct: number) {
  if (pct >= 80) return styles.healthGood
  if (pct >= 60) return styles.healthFair
  return styles.healthPoor
}
