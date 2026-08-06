'use client'

import { useRef, useState, useTransition } from 'react'
import {
  ALL_STAGES,
  COSMETIC_CONDITIONS,
  COSMETIC_CONDITION_LABELS,
  RETIREMENT_REASONS,
  RETIREMENT_REASON_LABELS,
  STAGE_LABELS,
  SUB_STATUSES,
  SUB_STATUS_LABELS,
  type EquipmentStage,
} from '@/lib/types'
import { bulkUpdateEquipment } from './actions'
import { CLEAR_VALUE, type BulkEditState } from './bulk-edit'
import { SORT_COLUMNS, formatDate, sortHref, type SortDir, type SortKey } from './table-config'
import styles from './EquipmentTable.module.css'

export type EquipmentRow = {
  id: string
  internalId: string
  make: string | null
  model: string | null
  stage: string
  subStatus: string | null
  /** Display name of the assigned technician; null when nobody is assigned. */
  techName: string | null
  /** True when a technician is assigned but their profile isn't readable under RLS. */
  techHidden: boolean
  condition: string | null
  donorName: string | null
  sourceDetail: string | null
  destName: string | null
  dateReceived: string | null
  dateSent: string | null
}

export type PickerOption = { id: string; name: string }

type Props = {
  rows: EquipmentRow[]
  canBulkEdit: boolean
  donorOrgs: PickerOption[]
  destinationOrgs: PickerOption[]
  technicians: PickerOption[]
  baseQuery: string
  activeSort: SortKey | null
  activeDir: SortDir
}

const BULK_FORM_ID = 'bulk-edit'

const initialState: BulkEditState = { error: null, message: null }

export function EquipmentTable({
  rows,
  canBulkEdit,
  donorOrgs,
  destinationOrgs,
  technicians,
  baseQuery,
  activeSort,
  activeDir,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [stageValue, setStageValue] = useState('')
  const [clearSource, setClearSource] = useState(false)
  // Remounts the fields after a successful apply so they reset to "unchanged"
  const [formKey, setFormKey] = useState(0)
  const [state, setState] = useState<BulkEditState>(initialState)
  const [pending, startTransition] = useTransition()

  // useTransition rather than useActionState: the selection and the field
  // values have to be reset once the action reports success.
  function applyBulkEdit(formData: FormData) {
    startTransition(async () => {
      const result = await bulkUpdateEquipment(state, formData)
      setState(result)
      if (result.message) {
        setSelected(new Set())
        setStageValue('')
        setClearSource(false)
        setFormKey((k) => k + 1)
      }
    })
  }

  // A row can disappear from under a stale selection when filters change.
  const visibleIds = rows.map((r) => r.id)
  const selectedIds = visibleIds.filter((id) => selected.has(id))
  const allSelected = selectedIds.length === rows.length && rows.length > 0

  // Anchor for shift-click ranges. Held as an id, not an index, so sorting or
  // filtering between clicks can't point it at the wrong row.
  const anchorId = useRef<string | null>(null)
  const shiftHeld = useRef(false)

  function toggleRow(id: string) {
    const anchor = shiftHeld.current ? anchorId.current : null
    shiftHeld.current = false
    anchorId.current = id

    setSelected((prev) => {
      const next = new Set(prev)
      const select = !next.has(id)
      const apply = (rowId: string) => {
        if (select) next.add(rowId)
        else next.delete(rowId)
      }

      const from = anchor === null ? -1 : visibleIds.indexOf(anchor)
      const to = visibleIds.indexOf(id)
      // Anchor row is gone (filters changed) — fall back to a single toggle
      if (from === -1 || to === -1) {
        apply(id)
        return next
      }

      for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
        apply(visibleIds[i])
      }
      return next
    })
  }

  function toggleAll() {
    anchorId.current = null
    setSelected(allSelected ? new Set() : new Set(visibleIds))
  }

  return (
    <>
      {canBulkEdit && selectedIds.length > 0 && (
        <form id={BULK_FORM_ID} action={applyBulkEdit} className={styles.bulkBar}>
          {/* Carried as hidden inputs rather than named checkboxes so the
              payload never depends on DOM form-owner reassociation. */}
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}

          <div className={styles.bulkHeader}>
            <span className={styles.bulkCount}>
              {selectedIds.length} selected
            </span>
            <span className={styles.bulkHint}>
              Fields left on “Unchanged” or blank are not touched.
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelected(new Set())}
              disabled={pending}
            >
              Clear selection
            </button>
          </div>

          {state.error && <p className="form-error">{state.error}</p>}

          <div key={formKey} className={styles.bulkGrid}>
            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-stage">Stage</label>
              <select
                id="bulk-stage"
                name="stage"
                className="select"
                value={stageValue}
                onChange={(e) => setStageValue(e.target.value)}
              >
                <option value="">Unchanged</option>
                {ALL_STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-sub">Sub-status</label>
              <select id="bulk-sub" name="sub_status" className="select" defaultValue="">
                <option value="">Unchanged</option>
                <option value={CLEAR_VALUE}>— None —</option>
                {SUB_STATUSES.map((s) => (
                  <option key={s} value={s}>{SUB_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-donor">Donor org</label>
              <select
                id="bulk-donor"
                name="donor_organization_id"
                className="select"
                defaultValue=""
              >
                <option value="">Unchanged</option>
                <option value={CLEAR_VALUE}>— No donor —</option>
                {donorOrgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-source">Source detail</label>
              <input
                id="bulk-source"
                name="source_detail"
                className="input"
                placeholder="Blank = unchanged"
                disabled={clearSource}
              />
              {/* Free text has no "empty means clear" state, so clearing is
                  explicit — and this panel is the only way to change it. */}
              <label className={styles.bulkCheckbox}>
                <input
                  type="checkbox"
                  name="source_detail_clear"
                  checked={clearSource}
                  onChange={(e) => setClearSource(e.target.checked)}
                />
                Erase existing text
              </label>
            </div>

            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-dest">Destination org</label>
              <select
                id="bulk-dest"
                name="destination_organization_id"
                className="select"
                defaultValue=""
              >
                <option value="">Unchanged</option>
                <option value={CLEAR_VALUE}>— Unassign —</option>
                {destinationOrgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-tech">Technician</label>
              <select
                id="bulk-tech"
                name="assigned_technician_id"
                className="select"
                defaultValue=""
              >
                <option value="">Unchanged</option>
                <option value={CLEAR_VALUE}>— Unassign —</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-condition">Condition</label>
              <select
                id="bulk-condition"
                name="cosmetic_condition"
                className="select"
                defaultValue=""
              >
                <option value="">Unchanged</option>
                <option value={CLEAR_VALUE}>— None —</option>
                {COSMETIC_CONDITIONS.map((c) => (
                  <option key={c} value={c}>{COSMETIC_CONDITION_LABELS[c]}</option>
                ))}
              </select>
            </div>

            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-acquired">Date acquired</label>
              <input id="bulk-acquired" type="date" name="date_acquired" className="input" />
            </div>

            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-received">Date received</label>
              <input id="bulk-received" type="date" name="date_received" className="input" />
            </div>

            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-sent">Date sent</label>
              <input id="bulk-sent" type="date" name="date_sent" className="input" />
            </div>

            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-delivered">Date delivered</label>
              <input id="bulk-delivered" type="date" name="date_delivered" className="input" />
            </div>

            <div className={styles.bulkField}>
              <label className="label" htmlFor="bulk-due">Tech due date</label>
              <input id="bulk-due" type="date" name="tech_due_date" className="input" />
            </div>

            {stageValue === 'retired' && (
              <div className={styles.bulkField}>
                <label className="label" htmlFor="bulk-reason">Retirement reason</label>
                <select id="bulk-reason" name="retirement_reason" className="select" required>
                  <option value="">Select a reason…</option>
                  {RETIREMENT_REASONS.map((r) => (
                    <option key={r} value={r}>{RETIREMENT_REASON_LABELS[r]}</option>
                  ))}
                </select>
              </div>
            )}

            {stageValue && (
              <div className={`${styles.bulkField} ${styles.bulkFieldWide}`}>
                <label className="label" htmlFor="bulk-note">Stage change note</label>
                <input
                  id="bulk-note"
                  name="reason"
                  className="input"
                  placeholder="Recorded on each device’s stage history (optional)"
                />
              </div>
            )}
          </div>

          <div className={styles.bulkFooter}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? 'Applying…' : `Apply to ${selectedIds.length} device${selectedIds.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      )}

      {state.message && selectedIds.length === 0 && (
        <p className={styles.bulkSuccess} aria-live="polite">{state.message}</p>
      )}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              {canBulkEdit && (
                <th className={styles.checkCell}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      // Partial selection reads as a dash rather than unchecked
                      if (el) el.indeterminate = selectedIds.length > 0 && !allSelected
                    }}
                    onChange={toggleAll}
                    aria-label={`Select all ${rows.length} filtered rows`}
                  />
                </th>
              )}
              {SORT_COLUMNS.map((col) => {
                const isActive = activeSort === col.key
                return (
                  <th key={col.key} aria-sort={isActive ? (activeDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <a
                      href={sortHref(baseQuery, col.key, activeSort, activeDir)}
                      className={`${styles.sortLink} ${isActive ? styles.sortActive : ''}`}
                    >
                      {col.label}
                      <span className={styles.sortIcon} aria-hidden="true">
                        {isActive ? (activeDir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </a>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = selected.has(row.id)
              return (
                <tr key={row.id} className={isSelected ? styles.rowSelected : undefined}>
                  {canBulkEdit && (
                    <td className={styles.checkCell}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        // The modifier is only on the click; onChange sees a
                        // synthetic change event, so stash it first.
                        onClick={(e) => { shiftHeld.current = e.shiftKey }}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.internalId}`}
                        title="Shift-click to select a range"
                      />
                    </td>
                  )}
                  <td>
                    <a href={`/equipment/${row.id}`} className="table-link">
                      {row.internalId}
                    </a>
                  </td>
                  <td>
                    {row.make || row.model
                      ? [row.make, row.model].filter(Boolean).join(' ')
                      : <span className="table-muted">—</span>}
                  </td>
                  <td>
                    <span className={`badge badge-${row.stage}`}>
                      {STAGE_LABELS[row.stage as EquipmentStage] ?? row.stage}
                    </span>
                    {row.subStatus && (
                      <span className={styles.subStatus}>
                        {SUB_STATUS_LABELS[row.subStatus as keyof typeof SUB_STATUS_LABELS] ?? row.subStatus}
                      </span>
                    )}
                  </td>
                  <td className="table-muted">
                    {row.techName ? (
                      <span className={styles.techName}>{row.techName}</span>
                    ) : row.techHidden ? (
                      <span title="Assigned to a user whose profile you can't view">Assigned</span>
                    ) : (
                      <span className={styles.unassigned}>Unassigned</span>
                    )}
                  </td>
                  <td>
                    {row.condition
                      ? <span className={`badge badge-${row.condition}`}>{row.condition}</span>
                      : <span className="table-muted">—</span>}
                  </td>
                  <td className="table-muted">
                    {row.donorName ?? '—'}
                    {row.sourceDetail && (
                      <span className={styles.sourceDetail}>{row.sourceDetail}</span>
                    )}
                  </td>
                  <td className="table-muted">{row.destName ?? '—'}</td>
                  <td className="table-muted">{formatDate(row.dateReceived) ?? '—'}</td>
                  <td className="table-muted">{formatDate(row.dateSent) ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
