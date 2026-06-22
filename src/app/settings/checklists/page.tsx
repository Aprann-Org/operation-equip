import { getCurrentUserContext } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { CreateTemplateForm } from './CreateTemplateForm'
import { ChecklistEditor } from './ChecklistEditor'

export const metadata = { title: 'Checklist Templates — Settings' }

export default async function ChecklistsSettingsPage() {
  const ctx = await getCurrentUserContext()
  const supabase = await createClient()

  const [{ data: templates }, { data: equipmentTypes }] = await Promise.all([
    supabase
      .from('checklist_templates')
      .select(`
        id, name, version, is_active,
        equipment_type:equipment_types!equipment_type_id ( id, name ),
        checklist_items ( id, order, label, result_type, required, help_text )
      `)
      .eq('organization_id', ctx!.organizationId as string)
      .order('is_active', { ascending: false }),
    supabase.from('equipment_types').select('id, name').order('name'),
  ])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Checklist Templates</h1>
          <p className="page-subtitle">Define QA steps for each equipment type.</p>
        </div>
      </div>

      {/* Create new template */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header"><span className="card-title">New Template</span></div>
        <div className="card-body">
          <CreateTemplateForm equipmentTypes={equipmentTypes ?? []} />
        </div>
      </div>

      {/* Existing templates */}
      {(templates ?? []).length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <span>No checklist templates yet. Create one above.</span>
          </div>
        </div>
      ) : (
        (templates ?? []).map(t => {
          const equipType = (t.equipment_type as unknown as { id: string; name: string } | null)
          const items = ((t.checklist_items ?? []) as {
            id: string; order: number; label: string; result_type: string; required: boolean; help_text: string | null
          }[]).sort((a, b) => a.order - b.order)

          return (
            <div key={t.id} className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">
                <div>
                  <span className="card-title">{t.name}</span>
                  <span className="table-muted" style={{ marginLeft: 10, fontSize: 12 }}>
                    {equipType?.name} · v{t.version} · {items.length} items
                  </span>
                </div>
                <span className={`badge ${t.is_active ? 'badge-active' : 'badge-archived'}`}>
                  {t.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="card-body">
                {t.is_active ? (
                  <ChecklistEditor templateId={t.id} items={items} />
                ) : (
                  <p className="table-muted" style={{ fontSize: 13 }}>
                    This template is inactive. Create a new template for {equipType?.name} to add items.
                  </p>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
