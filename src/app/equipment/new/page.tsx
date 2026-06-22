import { createClient } from '@/utils/supabase/server'
import { NewEquipmentForm } from './NewEquipmentForm'

export const metadata = { title: 'Add Equipment — Operation Equip' }

export default async function NewEquipmentPage() {
  const supabase = await createClient()

  const [{ data: equipmentTypes }, { data: donorOrgs }] = await Promise.all([
    supabase.from('equipment_types').select('*').order('name'),
    supabase.from('organizations').select('*').in('type', ['donor', 'both']).eq('status', 'active').order('name'),
  ])

  return (
    <div className="page-container" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Add Equipment</h1>
          <p className="page-subtitle">Register a new device in the system.</p>
        </div>
        <a href="/equipment" className="btn btn-secondary">← Back</a>
      </div>

      <div className="card card-body">
        <NewEquipmentForm
          equipmentTypes={equipmentTypes ?? []}
          donorOrgs={donorOrgs ?? []}
        />
      </div>
    </div>
  )
}
