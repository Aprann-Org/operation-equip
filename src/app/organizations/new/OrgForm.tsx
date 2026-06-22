'use client'

import { useActionState } from 'react'
import { createOrganization } from '@/app/organizations/actions'

export function OrgForm() {
  const [state, formAction, isPending] = useActionState(createOrganization, { error: null })

  return (
    <form action={formAction}>
      {state.error && <p className="form-error">{state.error}</p>}

      <p className="form-section-label">Organization Details</p>
      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="name">Name *</label>
          <input id="name" name="name" required className="input" placeholder="e.g. Haiti Tech Initiative" />
        </div>
        <div className="field">
          <label className="label" htmlFor="type">Type *</label>
          <select id="type" name="type" required className="select">
            <option value="">Select type…</option>
            <option value="tenant">Tenant (us)</option>
            <option value="donor">Donor</option>
            <option value="recipient">Recipient</option>
            <option value="both">Both (donor & recipient)</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="ein">EIN</label>
          <input id="ein" name="ein" className="input" placeholder="XX-XXXXXXX" />
        </div>
      </div>

      <p className="form-section-label">Contact</p>
      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="key_contact_name">Key Contact Name</label>
          <input id="key_contact_name" name="key_contact_name" className="input" placeholder="Jane Smith" />
        </div>
        <div className="field">
          <label className="label" htmlFor="key_contact_email">Key Contact Email</label>
          <input id="key_contact_email" name="key_contact_email" type="email" className="input" placeholder="jane@org.org" />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="label" htmlFor="address">Address</label>
          <textarea id="address" name="address" className="textarea" rows={2} placeholder="Street, City, State, ZIP" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button type="submit" disabled={isPending} className="btn btn-primary">
          {isPending ? 'Saving…' : 'Create Organization'}
        </button>
        <a href="/organizations" className="btn btn-secondary">Cancel</a>
      </div>
    </form>
  )
}
