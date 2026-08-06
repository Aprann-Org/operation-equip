import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth'
import {
  ALL_STAGES,
  COSMETIC_CONDITIONS,
  COSMETIC_CONDITION_LABELS,
  STAGE_LABELS,
  SUB_STATUSES,
  SUB_STATUS_LABELS,
  type CosmeticCondition,
  type EquipmentStage,
  type EquipmentSubStatus,
} from '@/lib/types'
import { EquipmentTable, type EquipmentRow, type PickerOption } from './EquipmentTable'
import { SORT_COLUMNS, isSortKey, type SortDir, type SortKey } from './table-config'
import styles from './page.module.css'

const STAGE_TABS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  ...ALL_STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s] })),
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SearchParams = {
  stage?: string
  sub?: string
  type?: string
  condition?: string
  donor?: string
  dest?: string
  tech?: string
  q?: string
  sort?: string
  dir?: string
}

/** Columns whose value comes from a join, so they can't be ordered in Postgres. */
const JOINED_SORT_VALUES: Record<string, (r: EquipmentRow) => string | null> = {
  donor: (r) => r.donorName,
  dest: (r) => r.destName,
  tech: (r) => r.techName,
}

/** Prefer a real name, fall back to the email so a row is never blank. */
function displayName(u: { first_name: string; last_name: string; email: string }): string {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
}

/** Only pass through values the enum/uuid columns can actually hold. */
function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null
}

/** `none` is the sentinel for "no row assigned" on the nullable FK filters. */
function uuidOrNone(value: string | undefined): string | null {
  if (!value) return null
  if (value === 'none') return 'none'
  return UUID_RE.test(value) ? value : null
}

/**
 * `.or()` takes a comma-separated filter string, so a search term containing
 * its delimiters or `*`/`%` wildcards would change the query's meaning.
 */
function sanitizeSearch(value: string | undefined): string | null {
  if (!value) return null
  const cleaned = value.replace(/[,()*%\\"]/g, ' ').trim().slice(0, 100)
  return cleaned || null
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const ctx = await getCurrentUserContext()

  const stage = oneOf<EquipmentStage>(params.stage, ALL_STAGES)
  const sub = oneOf<EquipmentSubStatus>(params.sub, SUB_STATUSES)
  const condition = oneOf<CosmeticCondition>(params.condition, COSMETIC_CONDITIONS)
  const typeId = params.type && UUID_RE.test(params.type) ? params.type : null
  const donor = uuidOrNone(params.donor)
  const dest = uuidOrNone(params.dest)
  const tech = uuidOrNone(params.tech)
  const search = sanitizeSearch(params.q)

  const sortKey: SortKey | null = isSortKey(params.sort) ? params.sort : null
  const sortDir: SortDir = params.dir === 'desc' ? 'desc' : 'asc'
  const sortDef = sortKey ? SORT_COLUMNS.find((c) => c.key === sortKey)! : null

  let query = supabase
    .from('equipment')
    .select(`
      id, internal_id, make, model, stage, sub_status, cosmetic_condition,
      source_detail, date_received, date_sent, created_at,
      assigned_technician_id,
      donor_org:organizations!donor_organization_id ( name ),
      destination_org:organizations!destination_organization_id ( name ),
      assigned_tech:users!assigned_technician_id ( first_name, last_name, email )
    `)

  if (stage) query = query.eq('stage', stage)
  if (sub) query = query.eq('sub_status', sub)
  if (condition) query = query.eq('cosmetic_condition', condition)
  if (typeId) query = query.eq('equipment_type_id', typeId)
  if (donor === 'none') query = query.is('donor_organization_id', null)
  else if (donor) query = query.eq('donor_organization_id', donor)
  if (dest === 'none') query = query.is('destination_organization_id', null)
  else if (dest) query = query.eq('destination_organization_id', dest)
  if (tech === 'none') query = query.is('assigned_technician_id', null)
  else if (tech) query = query.eq('assigned_technician_id', tech)
  if (search) {
    const term = `%${search}%`
    query = query.or(
      [
        `internal_id.ilike.${term}`,
        `make.ilike.${term}`,
        `model.ilike.${term}`,
        `processor.ilike.${term}`,
        `source_detail.ilike.${term}`,
      ].join(',')
    )
  }

  if (sortDef?.column) {
    query = query.order(sortDef.column, { ascending: sortDir === 'asc', nullsFirst: false })
  }
  // Stable tiebreak, and the default ordering when nothing is sorted.
  query = query.order('created_at', { ascending: false })

  const [{ data: equipment, error }, { data: equipmentTypes }, { data: orgs }, { data: techRoles }] =
    await Promise.all([
      query,
      supabase.from('equipment_types').select('id, name').order('name'),
      supabase
        .from('organizations')
        .select('id, name, type')
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('user_roles')
        .select('user_id, role, users!user_id ( id, first_name, last_name, email )')
        .in('role', ['technician', 'org_admin']),
    ])

  let rows: EquipmentRow[] = (equipment ?? []).map((e) => {
    // The users table is readable per RLS — own profile, plus org members for
    // admins. A plain technician can hold an assignment we can't name, so the
    // id is what decides "unassigned", not the presence of the joined row.
    const tech = e.assigned_tech as unknown as
      | { first_name: string; last_name: string; email: string }
      | null

    return {
      id: e.id,
      internalId: e.internal_id,
      make: e.make,
      model: e.model,
      stage: e.stage,
      subStatus: e.sub_status,
      techName: tech ? displayName(tech) : null,
      techHidden: !!e.assigned_technician_id && !tech,
      condition: e.cosmetic_condition,
      donorName: (e.donor_org as unknown as { name: string } | null)?.name ?? null,
      sourceDetail: e.source_detail,
      destName: (e.destination_org as unknown as { name: string } | null)?.name ?? null,
      dateReceived: e.date_received,
      dateSent: e.date_sent,
    }
  })

  // Joined columns can't be ordered in the equipment query, so sort them here.
  // The list is unpaginated, so this sees every row the filters returned.
  if (sortKey && !sortDef?.column) {
    const value = JOINED_SORT_VALUES[sortKey] ?? (() => null)
    const factor = sortDir === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      if (av === bv) return 0
      if (av === null) return 1 // unset values sink to the bottom either way
      if (bv === null) return -1
      return av.localeCompare(bv) * factor
    })
  }

  const destinationOrgs: PickerOption[] = (orgs ?? [])
    .filter((o) => o.type === 'recipient' || o.type === 'both')
    .map((o) => ({ id: o.id, name: o.name }))

  const donorOrgs: PickerOption[] = (orgs ?? [])
    .filter((o) => o.type === 'donor' || o.type === 'both')
    .map((o) => ({ id: o.id, name: o.name }))

  const technicians: PickerOption[] = Array.from(
    new Map(
      (techRoles ?? []).flatMap((r) => {
        const u = r.users as unknown as {
          id: string
          first_name: string
          last_name: string
          email: string
        } | null
        if (!u) return []
        return [[u.id, { id: u.id, name: displayName(u) }] as const]
      })
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  // Everything except sort/dir, so header links keep the active filters.
  const baseQuery = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'sort' && key !== 'dir') baseQuery.set(key, value)
  }
  const tabQuery = new URLSearchParams(baseQuery)
  tabQuery.delete('stage')
  if (params.sort) tabQuery.set('sort', params.sort)
  if (params.dir) tabQuery.set('dir', params.dir)

  const filterCount = [sub, condition, typeId, donor, dest, tech, search].filter(Boolean).length

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipment</h1>
          <p className="page-subtitle">
            {rows.length} device{rows.length !== 1 ? 's' : ''}
            {stage ? ` · ${STAGE_LABELS[stage]}` : ''}
            {filterCount ? ` · ${filterCount} filter${filterCount !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <a href="/equipment/new" className="btn btn-primary">+ Add Equipment</a>
      </div>

      {/* Stage filter tabs — carry the other filters and the sort across */}
      <div className="tabs">
        {STAGE_TABS.map((s) => {
          const q = new URLSearchParams(tabQuery)
          if (s.key) q.set('stage', s.key)
          const qs = q.toString()
          return (
            <a
              key={s.key}
              href={qs ? `/equipment?${qs}` : '/equipment'}
              className={`tab ${(stage ?? '') === s.key ? 'tab-active' : ''}`}
            >
              {s.label}
            </a>
          )
        })}
      </div>

      {/* Plain GET form: filtering keeps working without client JS */}
      <form method="get" action="/equipment" className={styles.filterBar}>
        {stage && <input type="hidden" name="stage" value={stage} />}
        {params.sort && <input type="hidden" name="sort" value={params.sort} />}
        {params.dir && <input type="hidden" name="dir" value={params.dir} />}

        <div className={`${styles.filterField} ${styles.filterSearch}`}>
          <label className="label" htmlFor="q">Search</label>
          <input
            id="q"
            name="q"
            className="input"
            defaultValue={search ?? ''}
            placeholder="ID, make, model, processor"
          />
        </div>

        <div className={styles.filterField}>
          <label className="label" htmlFor="type">Type</label>
          <select id="type" name="type" className="select" defaultValue={typeId ?? ''}>
            <option value="">Any</option>
            {(equipmentTypes ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label className="label" htmlFor="sub">Sub-status</label>
          <select id="sub" name="sub" className="select" defaultValue={sub ?? ''}>
            <option value="">Any</option>
            {SUB_STATUSES.map((s) => (
              <option key={s} value={s}>{SUB_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label className="label" htmlFor="condition">Condition</label>
          <select id="condition" name="condition" className="select" defaultValue={condition ?? ''}>
            <option value="">Any</option>
            {COSMETIC_CONDITIONS.map((c) => (
              <option key={c} value={c}>{COSMETIC_CONDITION_LABELS[c]}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label className="label" htmlFor="donor">Donor</label>
          <select id="donor" name="donor" className="select" defaultValue={donor ?? ''}>
            <option value="">Any</option>
            <option value="none">No donor</option>
            {donorOrgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label className="label" htmlFor="dest">Destination</label>
          <select id="dest" name="dest" className="select" defaultValue={dest ?? ''}>
            <option value="">Any</option>
            <option value="none">Unassigned</option>
            {destinationOrgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label className="label" htmlFor="tech">Technician</label>
          <select id="tech" name="tech" className="select" defaultValue={tech ?? ''}>
            <option value="">Any</option>
            <option value="none">Unassigned</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterActions}>
          <button type="submit" className="btn btn-primary btn-sm">Apply</button>
          {(filterCount > 0 || sortKey) && (
            <a
              href={stage ? `/equipment?stage=${stage}` : '/equipment'}
              className="btn btn-secondary btn-sm"
            >
              Clear
            </a>
          )}
        </div>
      </form>

      <div className="card">
        {error && <p className="form-error" style={{ margin: '1rem' }}>{error.message}</p>}

        {!rows.length ? (
          <div className="empty-state">
            <span className="empty-icon">📦</span>
            <span>
              No equipment matches these filters
              {stage ? ` in "${STAGE_LABELS[stage]}"` : ''}.
            </span>
            <a href="/equipment/new" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
              Add a device
            </a>
          </div>
        ) : (
          <EquipmentTable
            rows={rows}
            canBulkEdit={!!ctx?.isSuperAdmin}
            donorOrgs={donorOrgs}
            destinationOrgs={destinationOrgs}
            technicians={technicians}
            baseQuery={baseQuery.toString()}
            activeSort={sortKey}
            activeDir={sortDir}
          />
        )}
      </div>
    </div>
  )
}
