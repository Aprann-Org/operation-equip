import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import {
  COSMETIC_CONDITION_LABELS,
  DISK_TYPE_LABELS,
  STAGE_LABELS,
  SUB_STATUS_LABELS,
  type CosmeticCondition,
  type DiskType,
  type EquipmentStage,
  type EquipmentSubStatus,
} from '@/lib/types'
import { formatDate } from '../table-config'
import { MAX_REPORT_ROWS } from './config'
import { ReportActions } from './ReportActions'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Test Report · Operation Equip',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ResultType = 'boolean' | 'text' | 'numeric'

type ItemDef = { label: string; order: number; result_type: ResultType; required: boolean }

type Result = {
  equipment_id: string
  result_boolean: boolean | null
  result_text: string | null
  result_numeric: number | null
  completed_at: string
  item: { label: string; order: number; result_type: ResultType } | null
}

type Status = 'passed' | 'failed' | 'incomplete' | 'untested' | 'no_checklist'

const STATUS_LABELS: Record<Status, string> = {
  passed: 'Passed',
  failed: 'Failed',
  incomplete: 'Incomplete',
  untested: 'Not started',
  no_checklist: 'No checklist',
}

type Device = {
  id: string
  internalId: string
  make: string | null
  model: string | null
  stage: EquipmentStage
  subStatus: EquipmentSubStatus | null
  techName: string | null
  techHidden: boolean
  condition: CosmeticCondition | null
  processor: string | null
  ramGb: number | null
  diskGb: number | null
  diskType: string | null
  battery: { pct: number | null; cycles: number | null } | null
  /**
   * Keyed by item label rather than id: a template edit creates new item rows,
   * and a result recorded against the old version should still line up under
   * the same column.
   */
  results: Map<string, Result>
  expected: Set<string>
  done: number
  total: number
  fails: number
  lastTested: string | null
  status: Status
}

type Column = { label: string; order: number; resultType: ResultType }

type Section = { typeName: string; columns: Column[]; devices: Device[] }

function displayName(u: { first_name: string; last_name: string; email: string }): string {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
}

function parseIds(raw: string | string[] | undefined): string[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : []
  const ids = values.flatMap((v) => v.split(',')).map((v) => v.trim()).filter((v) => UUID_RE.test(v))
  return Array.from(new Set(ids))
}

function resultText(r: Result | undefined): string {
  if (!r) return ''
  if (r.item?.result_type === 'boolean') return r.result_boolean ? 'Pass' : 'Fail'
  if (r.item?.result_type === 'numeric') return r.result_numeric != null ? String(r.result_numeric) : ''
  return r.result_text ?? ''
}

/** Quote for CSV, and neutralise free text that a spreadsheet would run as a formula. */
function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default async function EquipmentReportPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>
}) {
  const params = await searchParams
  const requested = parseIds(params.ids)
  const ids = requested.slice(0, MAX_REPORT_ROWS)

  if (!ids.length) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <span>No devices selected. Tick some rows on the equipment list, then choose “Test report”.</span>
            <a href="/equipment" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
              Back to equipment
            </a>
          </div>
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  const [{ data: equipment, error }, { data: resultRows }, { data: batteryRows }] = await Promise.all([
    supabase
      .from('equipment')
      .select(`
        id, internal_id, organization_id, equipment_type_id, make, model, processor,
        ram_gb, disk_capacity_gb, specs, stage, sub_status, cosmetic_condition,
        assigned_technician_id,
        equipment_type:equipment_types!equipment_type_id ( name ),
        assigned_tech:users!assigned_technician_id ( first_name, last_name, email )
      `)
      .in('id', ids),
    supabase
      .from('checklist_results')
      .select(`
        equipment_id, result_boolean, result_text, result_numeric, completed_at,
        item:checklist_items!checklist_item_id ( label, order, result_type )
      `)
      .in('equipment_id', ids),
    supabase
      .from('battery_reports')
      .select('equipment_id, percent_of_design, cycle_count, report_date, created_at')
      .in('equipment_id', ids)
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  const typeIds = Array.from(new Set((equipment ?? []).map((e) => e.equipment_type_id)))
  const { data: templates } = typeIds.length
    ? await supabase
        .from('checklist_templates')
        .select('organization_id, equipment_type_id, checklist_items ( label, order, result_type, required )')
        .eq('is_active', true)
        .in('equipment_type_id', typeIds)
    : { data: [] }

  // One active template per org + type (enforced by a partial unique index)
  const templateItems = new Map<string, ItemDef[]>()
  for (const t of templates ?? []) {
    templateItems.set(
      `${t.organization_id}:${t.equipment_type_id}`,
      (t.checklist_items as unknown as ItemDef[]) ?? []
    )
  }

  const resultsByDevice = new Map<string, Result[]>()
  for (const r of (resultRows ?? []) as unknown as Result[]) {
    const list = resultsByDevice.get(r.equipment_id) ?? []
    list.push(r)
    resultsByDevice.set(r.equipment_id, list)
  }

  // Rows arrive newest first, so the first one seen per device is its latest
  const latestBattery = new Map<string, { pct: number | null; cycles: number | null }>()
  for (const b of batteryRows ?? []) {
    if (!latestBattery.has(b.equipment_id)) {
      latestBattery.set(b.equipment_id, {
        pct: b.percent_of_design != null ? Number(b.percent_of_design) : null,
        cycles: b.cycle_count,
      })
    }
  }

  const sectionMap = new Map<string, Section & { columnMap: Map<string, Column> }>()

  for (const e of equipment ?? []) {
    const items = templateItems.get(`${e.organization_id}:${e.equipment_type_id}`) ?? []
    const results = resultsByDevice.get(e.id) ?? []
    const byLabel = new Map(results.filter((r) => r.item).map((r) => [r.item!.label, r]))

    const required = items.filter((i) => i.required)
    const fails = results.filter((r) => r.item?.result_type === 'boolean' && r.result_boolean === false).length
    const missingRequired = required.some((i) => !byLabel.has(i.label))
    const done = items.filter((i) => byLabel.has(i.label)).length

    let status: Status
    if (!items.length && !results.length) status = 'no_checklist'
    else if (fails > 0) status = 'failed'
    else if (!results.length) status = 'untested'
    else if (missingRequired) status = 'incomplete'
    else status = 'passed'

    const tech = e.assigned_tech as unknown as { first_name: string; last_name: string; email: string } | null
    const specs = (e.specs ?? {}) as Record<string, unknown>
    const diskType = typeof specs.disk_type === 'string' ? specs.disk_type : null

    const device: Device = {
      id: e.id,
      internalId: e.internal_id,
      make: e.make,
      model: e.model,
      stage: e.stage,
      subStatus: e.sub_status,
      techName: tech ? displayName(tech) : null,
      techHidden: !!e.assigned_technician_id && !tech,
      condition: e.cosmetic_condition,
      processor: e.processor,
      ramGb: e.ram_gb,
      diskGb: e.disk_capacity_gb,
      diskType: diskType ? (DISK_TYPE_LABELS[diskType as DiskType] ?? diskType) : null,
      battery: latestBattery.get(e.id) ?? null,
      results: byLabel,
      expected: new Set(items.map((i) => i.label)),
      done,
      total: items.length,
      fails,
      lastTested: results.reduce<string | null>(
        (max, r) => (!max || r.completed_at > max ? r.completed_at : max),
        null
      ),
      status,
    }

    const typeName = (e.equipment_type as unknown as { name: string } | null)?.name ?? 'Other'
    let section = sectionMap.get(e.equipment_type_id)
    if (!section) {
      section = { typeName, columns: [], devices: [], columnMap: new Map() }
      sectionMap.set(e.equipment_type_id, section)
    }
    section.devices.push(device)

    // Template items first, then any results left over from an older template
    const colSources = [
      ...items.map((i) => ({ label: i.label, order: i.order, resultType: i.result_type })),
      ...results.flatMap((r) =>
        r.item ? [{ label: r.item.label, order: r.item.order, resultType: r.item.result_type }] : []
      ),
    ]
    for (const c of colSources) {
      if (!section.columnMap.has(c.label)) section.columnMap.set(c.label, c)
    }
  }

  const byInternalId = (a: Device, b: Device) =>
    a.internalId.localeCompare(b.internalId, undefined, { numeric: true })

  const sections: Section[] = Array.from(sectionMap.values())
    .map((s) => ({
      typeName: s.typeName,
      columns: Array.from(s.columnMap.values()).sort((a, b) => a.order - b.order),
      devices: s.devices.sort(byInternalId),
    }))
    .sort((a, b) => a.typeName.localeCompare(b.typeName))

  const allDevices = sections.flatMap((s) => s.devices)
  const counts = allDevices.reduce(
    (acc, d) => ({ ...acc, [d.status]: acc[d.status] + 1 }),
    { passed: 0, failed: 0, incomplete: 0, untested: 0, no_checklist: 0 } as Record<Status, number>
  )

  // ── CSV: one sheet, checklist columns merged by label across types ──
  const csvLabels = Array.from(
    new Set(sections.flatMap((s) => s.columns.map((c) => c.label)))
  )
  const csvHeader = [
    'Type', 'ID', 'Make', 'Model', 'Stage', 'Sub-status', 'Technician', 'Condition',
    'Processor', 'RAM (GB)', 'Disk (GB)', 'Disk type', 'Battery health %', 'Battery cycles',
    'Result', 'Checks done', 'Checks total', 'Failures', 'Last tested',
    ...csvLabels,
  ]
  const csvRows = sections.flatMap((s) =>
    s.devices.map((d) => [
      s.typeName,
      d.internalId,
      d.make,
      d.model,
      STAGE_LABELS[d.stage],
      d.subStatus ? SUB_STATUS_LABELS[d.subStatus] : '',
      d.techName ?? (d.techHidden ? 'Assigned' : ''),
      d.condition ? COSMETIC_CONDITION_LABELS[d.condition] : '',
      d.processor,
      d.ramGb,
      d.diskGb,
      d.diskType,
      d.battery?.pct,
      d.battery?.cycles,
      STATUS_LABELS[d.status],
      d.done,
      d.total,
      d.fails,
      d.lastTested ? d.lastTested.slice(0, 10) : '',
      ...csvLabels.map((label) => resultText(d.results.get(label))),
    ])
  )
  const csv = [csvHeader, ...csvRows].map((row) => row.map(csvCell).join(',')).join('\r\n')

  const today = new Date().toISOString().slice(0, 10)
  const missing = ids.length - allDevices.length
  const truncated = requested.length - ids.length

  return (
    <div className={`page-container ${styles.container}`}>
      <div className="page-header">
        <div>
          <a href="/equipment" className={`${styles.back} no-print`}>← Equipment</a>
          <h1 className="page-title">Test Report</h1>
          <p className="page-subtitle">
            {allDevices.length} device{allDevices.length !== 1 ? 's' : ''} · generated {formatDate(today)}
          </p>
        </div>
        {allDevices.length > 0 && <ReportActions csv={csv} filename={`test-report-${today}.csv`} />}
      </div>

      {error && <p className="form-error">{error.message}</p>}
      {truncated > 0 && (
        <p className={styles.notice}>
          Showing the first {MAX_REPORT_ROWS} of {requested.length} selected devices.
        </p>
      )}
      {missing > 0 && (
        <p className={styles.notice}>
          {missing} selected device{missing !== 1 ? 's' : ''} could not be loaded — deleted, or
          outside your organization.
        </p>
      )}

      {allDevices.length > 0 && (
        <div className={styles.summary}>
          <SummaryTile label="Devices" value={allDevices.length} />
          <SummaryTile label="Passed" value={counts.passed} tone="passed" />
          <SummaryTile label="Failed" value={counts.failed} tone="failed" />
          <SummaryTile label="Incomplete" value={counts.incomplete} tone="incomplete" />
          <SummaryTile label="Not started" value={counts.untested + counts.no_checklist} />
        </div>
      )}

      {sections.map((section) => (
        <div key={section.typeName} className={`card ${styles.section}`}>
          <div className="card-header">
            <span className="card-title">{section.typeName}</span>
            <span className="table-muted">
              {section.devices.length} device{section.devices.length !== 1 ? 's' : ''}
              {section.columns.length ? ` · ${section.columns.length} checks` : ''}
            </span>
          </div>
          <div className="table-wrapper">
            <table className={`table ${styles.table}`}>
              <thead>
                <tr>
                  <th className={styles.stickyCol}>ID</th>
                  <th>Make / Model</th>
                  <th>Stage</th>
                  <th>Technician</th>
                  <th>Condition</th>
                  <th>Specs</th>
                  <th>Battery</th>
                  <th>Result</th>
                  {section.columns.map((c) => (
                    <th key={c.label} className={styles.checkHead} title={c.label}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.devices.map((d) => (
                  <tr key={d.id} className={d.status === 'failed' ? styles.rowFailed : undefined}>
                    <td className={styles.stickyCol}>
                      <a href={`/equipment/${d.id}`} className="table-link">{d.internalId}</a>
                    </td>
                    <td className={styles.nowrap}>
                      {[d.make, d.model].filter(Boolean).join(' ') || <span className="table-muted">—</span>}
                    </td>
                    <td>
                      <span className={`badge badge-${d.stage}`}>{STAGE_LABELS[d.stage]}</span>
                      {d.subStatus && <span className={styles.sub}>{SUB_STATUS_LABELS[d.subStatus]}</span>}
                    </td>
                    <td className={`table-muted ${styles.nowrap}`}>
                      {d.techName ?? (d.techHidden ? 'Assigned' : <em>Unassigned</em>)}
                    </td>
                    <td>
                      {d.condition
                        ? <span className={`badge badge-${d.condition}`}>{COSMETIC_CONDITION_LABELS[d.condition]}</span>
                        : <span className="table-muted">—</span>}
                    </td>
                    <td className={`table-muted ${styles.specs}`}>
                      {d.processor && <span>{d.processor}</span>}
                      <span>
                        {[
                          d.ramGb != null ? `${d.ramGb} GB RAM` : null,
                          d.diskGb != null ? `${d.diskGb} GB${d.diskType ? ` ${d.diskType}` : ''}` : null,
                        ].filter(Boolean).join(' · ') || (!d.processor ? '—' : '')}
                      </span>
                    </td>
                    <td className={styles.nowrap}>
                      {d.battery?.pct != null ? (
                        <>
                          <span className={healthClass(d.battery.pct)}>{Math.round(d.battery.pct)}%</span>
                          {d.battery.cycles != null && (
                            <span className={styles.sub}>{d.battery.cycles} cycles</span>
                          )}
                        </>
                      ) : (
                        <span className="table-muted">—</span>
                      )}
                    </td>
                    <td className={styles.nowrap}>
                      <span className={`${styles.status} ${styles[`status_${d.status}`]}`}>
                        {STATUS_LABELS[d.status]}
                      </span>
                      {d.total > 0 && (
                        <span className={styles.sub}>
                          {d.done}/{d.total} done{d.fails ? ` · ${d.fails} failed` : ''}
                        </span>
                      )}
                      {d.lastTested && <span className={styles.sub}>{formatDate(d.lastTested)}</span>}
                    </td>
                    {section.columns.map((c) => (
                      <ResultCell
                        key={c.label}
                        result={d.results.get(c.label)}
                        expected={d.expected.has(c.label)}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: Status }) {
  return (
    <div className={styles.tile}>
      <span className={`${styles.tileValue} ${tone && value ? styles[`tone_${tone}`] : ''}`}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  )
}

function ResultCell({ result, expected }: { result?: Result; expected: boolean }) {
  if (!result) {
    return (
      <td className={styles.checkCell}>
        {expected
          ? <span className={styles.pending} title="Not yet recorded">—</span>
          : <span className={styles.na} title="Not on this device’s checklist">n/a</span>}
      </td>
    )
  }
  if (result.item?.result_type === 'boolean') {
    return (
      <td className={`${styles.checkCell} ${result.result_boolean ? '' : styles.cellFail}`}>
        <span className={result.result_boolean ? styles.pass : styles.fail}>
          {result.result_boolean ? '✓ Pass' : '✗ Fail'}
        </span>
      </td>
    )
  }
  const text = resultText(result)
  return (
    <td className={styles.checkCell}>
      <span className={styles.textResult} title={text}>{text}</span>
    </td>
  )
}

function healthClass(pct: number) {
  if (pct >= 80) return styles.healthGood
  if (pct >= 60) return styles.healthFair
  return styles.healthPoor
}
