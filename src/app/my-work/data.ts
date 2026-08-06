import { createClient } from '@/utils/supabase/server'
import type { EquipmentStage, EquipmentSubStatus } from '@/lib/types'
import { daysUntil, type WorkItem } from './work-queue'

type SupabaseJoin<T> = T | T[] | null

/** PostgREST returns an embedded to-one row as an object, but the generated types widen it. */
export function one<T>(value: SupabaseJoin<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * Every device assigned to a technician, enriched with the QA progress and open
 * thread count the queue is triaged by. Shared by /my-work and the dashboard
 * preview so the two can never disagree on what's on someone's bench.
 */
export async function getMyWorkItems(
  userId: string
): Promise<{ items: WorkItem[]; error: string | null }> {
  const supabase = await createClient()

  const { data: assigned, error } = await supabase
    .from('equipment')
    .select(`
      id, internal_id, make, model, stage, sub_status, cosmetic_condition,
      tech_due_date, equipment_type_id,
      equipment_type:equipment_types!equipment_type_id ( name ),
      destination_org:organizations!destination_organization_id ( name ),
      support_threads ( id, status )
    `)
    .eq('assigned_technician_id', userId)

  if (error) return { items: [], error: error.message }

  const rows = assigned ?? []
  const equipmentIds = rows.map((e) => e.id)

  // Checklist progress needs two lookups the equipment query can't join:
  // how many items the type's active template has, and how many are filled in.
  const [templatesRes, resultsRes] = await Promise.all([
    supabase
      .from('checklist_templates')
      .select('equipment_type_id, checklist_items ( id )')
      .eq('is_active', true),
    equipmentIds.length
      ? supabase.from('checklist_results').select('equipment_id').in('equipment_id', equipmentIds)
      : Promise.resolve({ data: [] as { equipment_id: string }[] }),
  ])

  const itemCountByType = new Map<string, number>()
  for (const t of templatesRes.data ?? []) {
    const items = (t.checklist_items ?? []) as unknown as { id: string }[]
    // Several orgs can each have an active template for the same type; the
    // longest is the safest denominator for a "x of y" progress read.
    itemCountByType.set(
      t.equipment_type_id,
      Math.max(itemCountByType.get(t.equipment_type_id) ?? 0, items.length)
    )
  }

  const doneByEquipment = new Map<string, number>()
  for (const r of resultsRes.data ?? []) {
    doneByEquipment.set(r.equipment_id, (doneByEquipment.get(r.equipment_id) ?? 0) + 1)
  }

  const items: WorkItem[] = rows.map((e) => {
    const threads = (e.support_threads ?? []) as unknown as { id: string; status: string }[]
    return {
      id: e.id,
      internalId: e.internal_id,
      deviceName: [e.make, e.model].filter(Boolean).join(' ') || e.internal_id,
      typeName: one<{ name: string }>(e.equipment_type)?.name ?? null,
      stage: e.stage as EquipmentStage,
      subStatus: e.sub_status as EquipmentSubStatus | null,
      condition: e.cosmetic_condition,
      dueDate: e.tech_due_date,
      daysUntilDue: daysUntil(e.tech_due_date),
      destName: one<{ name: string }>(e.destination_org)?.name ?? null,
      openThreads: threads.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length,
      checklistDone: doneByEquipment.get(e.id) ?? 0,
      checklistTotal: itemCountByType.get(e.equipment_type_id) ?? 0,
    }
  })

  return { items, error: null }
}
