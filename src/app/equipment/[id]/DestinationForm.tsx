'use client'

import { useActionState } from 'react'
import { updateDestination } from './actions'

type Org = { id: string; name: string }
type User = { id: string; first_name: string; last_name: string; email: string }

type Props = {
  equipmentId: string
  currentDestOrgId: string | null
  currentDestPersonId: string | null
  currentTechDueDate: string | null
  recipientOrgs: Org[]
  orgUsers: User[]
}

export function DestinationForm({
  equipmentId,
  currentDestOrgId,
  currentDestPersonId,
  currentTechDueDate,
  recipientOrgs,
  orgUsers,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => updateDestination(formData),
    {}
  )

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <input type="hidden" name="equipment_id" value={equipmentId} />
      {state.error && <p className="form-error">{state.error}</p>}

      <div className="field">
        <label className="label">Recipient Organization</label>
        <select name="destination_organization_id" defaultValue={currentDestOrgId ?? ''} className="select">
          <option value="">None</option>
          {recipientOrgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {orgUsers.length > 0 && (
        <div className="field">
          <label className="label">Recipient Individual</label>
          <select name="destination_person_id" defaultValue={currentDestPersonId ?? ''} className="select">
            <option value="">None</option>
            {orgUsers.map((u) => {
              const name = `${u.first_name} ${u.last_name}`.trim() || u.email
              return <option key={u.id} value={u.id}>{name}</option>
            })}
          </select>
        </div>
      )}

      <div className="field">
        <label className="label">Tech Due Date</label>
        <input
          name="tech_due_date"
          type="date"
          defaultValue={currentTechDueDate ?? ''}
          className="input"
        />
      </div>

      <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm">
        {isPending ? 'Saving…' : 'Save Destination'}
      </button>
    </form>
  )
}
