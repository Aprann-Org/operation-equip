import { createClient } from '@/utils/supabase/server'
import { NewEquipmentForm, type EquipmentDefaults } from './NewEquipmentForm'

export const metadata = { title: 'Add Equipment — Operation Equip' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function NewEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams
  const fromId = typeof from === 'string' && UUID_RE.test(from) ? from : null
  const supabase = await createClient()

  const [{ data: equipmentTypes }, { data: donorOrgs }, { data: existing }, sourceRes] = await Promise.all([
    supabase.from('equipment_types').select('*').order('name'),
    supabase.from('organizations').select('*').in('type', ['donor', 'both']).eq('status', 'active').order('name'),
    supabase
      .from('equipment')
      .select('id, internal_id, make, model')
      .order('created_at', { ascending: false })
      .limit(500),
    fromId
      ? supabase
          .from('equipment')
          .select('id, internal_id, equipment_type_id, make, model, processor, ram_gb, disk_capacity_gb, specs, donor_organization_id, source_detail, date_acquired, sponsor_name, sponsor_email')
          .eq('id', fromId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const source = sourceRes.data
  const defaults: EquipmentDefaults | null = source
    ? {
        equipment_type_id: source.equipment_type_id,
        make: source.make,
        model: source.model,
        processor: source.processor,
        ram_gb: source.ram_gb,
        disk_capacity_gb: source.disk_capacity_gb,
        disk_type: (source.specs?.disk_type as string | undefined) ?? null,
        screen_size_in: (source.specs?.screen_size_in as number | undefined) ?? null,
        os: (source.specs?.os as string | undefined) ?? null,
        donor_organization_id: source.donor_organization_id,
        source_detail: source.source_detail,
        date_acquired: source.date_acquired,
        sponsor_name: source.sponsor_name,
        sponsor_email: source.sponsor_email,
      }
    : null

  return (
    <div className="page-container" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Add Equipment</h1>
          <p className="page-subtitle">
            {source
              ? `Duplicating ${source.internal_id} — enter a new Internal ID and condition.`
              : 'Register a new device in the system.'}
          </p>
        </div>
        <a href="/equipment" className="btn btn-secondary">← Back</a>
      </div>

      {(existing?.length ?? 0) > 0 && (
        <form method="get" className="card card-body" style={{ marginBottom: 16 }}>
          <p className="form-section-label" style={{ marginTop: 0 }}>Copy from existing</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              name="from"
              defaultValue={source?.id ?? ''}
              className="select"
              aria-label="Equipment to copy from"
              style={{ flex: '1 1 260px' }}
            >
              <option value="">Start blank…</option>
              {existing!.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.internal_id}
                  {e.make || e.model ? ` — ${[e.make, e.model].filter(Boolean).join(' ')}` : ''}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary">Copy</button>
          </div>
          <p className="field-hint">Prefills type, hardware and provenance. Internal ID and condition are left blank.</p>
        </form>
      )}

      <div className="card card-body">
        <NewEquipmentForm
          key={source?.id ?? 'blank'}
          equipmentTypes={equipmentTypes ?? []}
          donorOrgs={donorOrgs ?? []}
          defaults={defaults}
        />
      </div>
    </div>
  )
}
