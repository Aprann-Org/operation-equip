'use client'

import { useActionState } from 'react'
import { createTemplate } from './actions'

type EquipmentType = { id: string; name: string }

export function CreateTemplateForm({ equipmentTypes }: { equipmentTypes: EquipmentType[] }) {
  const [state, formAction, isPending] = useActionState(createTemplate, { error: null })

  return (
    <form action={formAction}>
      {state.error && <p className="form-error">{state.error}</p>}
      <div className="form-grid">
        <div className="field">
          <label className="label">Equipment Type *</label>
          <select name="equipment_type_id" required className="select">
            <option value="">Select type…</option>
            {equipmentTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">Template Name *</label>
          <input name="name" required className="input" placeholder="e.g. Laptop QA — v2" />
        </div>
      </div>
      <p className="field-hint" style={{ marginBottom: 10 }}>
        Creating a new template deactivates the current one for that equipment type.
      </p>
      <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
        {isPending ? 'Creating…' : 'Create Template'}
      </button>
    </form>
  )
}
