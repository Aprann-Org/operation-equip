'use client'

import { useActionState } from 'react'
import { createEquipment } from '@/app/equipment/actions'
import type { EquipmentType, Organization } from '@/lib/types'

type Props = {
  equipmentTypes: EquipmentType[]
  donorOrgs: Organization[]
}

export function NewEquipmentForm({ equipmentTypes, donorOrgs }: Props) {
  const [state, formAction, isPending] = useActionState(createEquipment, { error: null })

  return (
    <form action={formAction}>
      {state.error && <p className="form-error">{state.error}</p>}

      <p className="form-section-label">Identification</p>
      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="equipment_type_id">Equipment Type *</label>
          <select id="equipment_type_id" name="equipment_type_id" required className="select">
            <option value="">Select type…</option>
            {equipmentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="internal_id">Internal ID *</label>
          <input id="internal_id" name="internal_id" required className="input" placeholder="e.g. APR-0042" />
          <p className="field-hint">Must be unique within your organization.</p>
        </div>
      </div>

      <p className="form-section-label">Hardware</p>
      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="make">Make</label>
          <input id="make" name="make" className="input" placeholder="e.g. Dell, Apple, HP" />
        </div>
        <div className="field">
          <label className="label" htmlFor="model">Model</label>
          <input id="model" name="model" className="input" placeholder="e.g. Latitude 5490" />
        </div>
        <div className="field">
          <label className="label" htmlFor="processor">Processor</label>
          <input id="processor" name="processor" className="input" placeholder="e.g. Intel Core i5-8250U" />
        </div>
        <div className="field">
          <label className="label" htmlFor="ram_gb">RAM (GB)</label>
          <input id="ram_gb" name="ram_gb" type="number" min="1" max="512" className="input" placeholder="e.g. 8" />
        </div>
        <div className="field">
          <label className="label" htmlFor="disk_capacity_gb">Disk Capacity (GB)</label>
          <input id="disk_capacity_gb" name="disk_capacity_gb" type="number" min="1" className="input" placeholder="e.g. 256" />
        </div>
        <div className="field">
          <label className="label" htmlFor="disk_type">Disk Type</label>
          <select id="disk_type" name="disk_type" className="select">
            <option value="">Select…</option>
            <option value="ssd">SSD</option>
            <option value="hdd">HDD</option>
            <option value="nvme">NVMe</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="screen_size_in">Screen Size (inches)</label>
          <input id="screen_size_in" name="screen_size_in" type="number" step="0.1" min="1" className="input" placeholder="e.g. 13.3" />
        </div>
        <div className="field">
          <label className="label" htmlFor="os">Operating System</label>
          <input id="os" name="os" className="input" placeholder="e.g. Windows 11 Pro" />
        </div>
      </div>

      <p className="form-section-label">Condition</p>
      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="cosmetic_condition">Cosmetic Condition</label>
          <select id="cosmetic_condition" name="cosmetic_condition" className="select">
            <option value="">Select…</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="cosmetic_notes">Condition Notes</label>
          <input id="cosmetic_notes" name="cosmetic_notes" className="input" placeholder="Any visible damage or wear" />
        </div>
      </div>

      <p className="form-section-label">Provenance</p>
      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="donor_organization_id">Donor Organization</label>
          <select id="donor_organization_id" name="donor_organization_id" className="select">
            <option value="">None / Unknown</option>
            {donorOrgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="source_detail">Source Detail</label>
          <input id="source_detail" name="source_detail" className="input" placeholder="e.g. Corporate donation Q1 2026" />
        </div>
        <div className="field">
          <label className="label" htmlFor="date_acquired">Date Acquired</label>
          <input id="date_acquired" name="date_acquired" type="date" className="input" />
        </div>
        <div className="field">
          <label className="label" htmlFor="sponsor_name">Sponsor Name</label>
          <input id="sponsor_name" name="sponsor_name" className="input" placeholder="Individual or company sponsor" />
        </div>
        <div className="field">
          <label className="label" htmlFor="sponsor_email">Sponsor Email</label>
          <input id="sponsor_email" name="sponsor_email" type="email" className="input" placeholder="sponsor@example.com" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button type="submit" disabled={isPending} className="btn btn-primary">
          {isPending ? 'Saving…' : 'Add Equipment'}
        </button>
        <a href="/equipment" className="btn btn-secondary">Cancel</a>
      </div>
    </form>
  )
}
