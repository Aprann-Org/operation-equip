import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { hashIntakeKey, readBearerKey } from '@/lib/intake-keys'
import {
  checkIdentity,
  parseIntakePayload,
  planAutofill,
  type FieldChange,
  type ReportedBattery,
} from '@/lib/intake'

/**
 * POST /api/intake/autofill
 *
 * Called by scripts/intake/Invoke-EquipIntake.ps1 running on the laptop itself.
 * Authenticates with an intake API key (Settings → Intake Keys), finds the
 * device by its laptop number within the key's organization, confirms the
 * laptop's serial / hardware UUID agree with that record, then fills in the
 * blank hardware fields. See src/lib/intake.ts for the rules.
 *
 * This route is exempt from the login redirect in proxy.ts and uses the
 * service-role client, so every query below is scoped to the key's
 * organization by hand — RLS is not there to catch a missing filter.
 */

const MAX_BODY_BYTES = 32_000

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function fail(status: number, error: string) {
  return json(status, { ok: false, error })
}

export async function POST(request: Request) {
  const key = readBearerKey(request.headers.get('authorization'))
  if (!key) return fail(401, 'Missing or malformed API key. Send it as "Authorization: Bearer oeq_…".')

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return fail(413, 'Request body is too large')

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return fail(400, 'Request body must be valid JSON')
  }

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return fail(500, 'Intake API is not configured on this server (SUPABASE_SERVICE_ROLE_KEY is not set)')
  }

  const { data: apiKey } = await supabase
    .from('intake_api_keys')
    .select('id, organization_id, label')
    .eq('key_hash', hashIntakeKey(key))
    .is('revoked_at', null)
    .maybeSingle()

  if (!apiKey) return fail(401, 'API key is invalid or has been revoked')
  const orgId = apiKey.organization_id as string

  const parsed = parseIntakePayload(body)
  if (!parsed.ok) return fail(400, parsed.error)
  const payload = parsed.value
  const warnings = [...parsed.warnings]

  if (!payload.serial_number && !payload.hardware_uuid) {
    warnings.push(
      'No usable serial number or hardware UUID was reported, so this laptop could not be verified against its record.'
    )
  }

  const { data: device } = await supabase
    .from('equipment')
    .select('id, internal_id, make, model, processor, ram_gb, disk_capacity_gb, specs, serial_number, hardware_uuid')
    .eq('organization_id', orgId)
    .eq('internal_id', payload.internal_id)
    .maybeSingle()

  if (!device) {
    // Point the tech at the right number if this laptop is already registered.
    const registeredAs = payload.serial_number
      ? await findBySerial(supabase, orgId, payload.serial_number)
      : null
    return fail(
      404,
      registeredAs
        ? `No laptop #${payload.internal_id} found. This laptop's serial is registered to #${registeredAs.internal_id}.`
        : `No laptop #${payload.internal_id} found. Add it in Operation Equip first, then run the script again.`
    )
  }

  const identity = checkIdentity(device, payload)
  if (!identity.ok) return fail(409, identity.error)

  if (identity.link.serial_number) {
    const other = await findBySerial(supabase, orgId, identity.link.serial_number)
    if (other && other.id !== device.id) {
      return fail(
        409,
        `This laptop's serial ${identity.link.serial_number} is already registered to #${other.internal_id}, ` +
          `not #${device.internal_id}. Check the laptop number.`
      )
    }
  }

  const plan = planAutofill(device, payload.hardware, payload.overwrite)
  const patch: Record<string, unknown> = { ...plan.patch, ...identity.link }
  const changes: FieldChange[] = [
    ...Object.entries(identity.link).map(([field, to]) => ({ field, from: null, to })),
    ...plan.changes,
  ]

  const deviceUrl = new URL(`/equipment/${device.id}`, request.url).toString()
  const summary = {
    equipment: { id: device.id, internal_id: device.internal_id, url: deviceUrl },
    changes: changes.map((c) => ({ field: c.field, from: c.from, to: c.to })),
    conflicts: plan.conflicts,
    warnings,
  }

  if (payload.dry_run) {
    return json(200, {
      ok: true,
      dry_run: true,
      ...summary,
      battery: payload.battery ? 'would_add' : 'none',
    })
  }

  if (changes.length) {
    const { error: updateError } = await supabase
      .from('equipment')
      .update(patch)
      .eq('id', device.id)
      .eq('organization_id', orgId)

    if (updateError) {
      // The unique serial index can still trip if another scan linked it a moment ago.
      if (updateError.code === '23505') {
        return fail(409, 'This laptop\'s serial number was just registered to another device. Check the laptop number.')
      }
      return fail(500, `Could not update the device: ${updateError.message}`)
    }

    const reason = `Auto-filled by intake script (key "${apiKey.label}")`
    const { error: historyError } = await supabase.from('equipment_spec_history').insert(
      changes.map((c) => ({
        organization_id: orgId,
        equipment_id: device.id,
        field: c.field,
        from_value: c.from == null ? null : String(c.from),
        to_value: c.to == null ? null : String(c.to),
        user_id: null,
        reason,
      }))
    )
    if (historyError) warnings.push(`Change history could not be recorded: ${historyError.message}`)
  }

  const battery = payload.battery ? await addBatteryReport(supabase, orgId, device.id, payload.battery) : 'none'
  if (battery === 'error') warnings.push('Battery report could not be saved')

  await supabase
    .from('intake_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)

  revalidatePath(`/equipment/${device.id}`)
  revalidatePath('/equipment')
  revalidatePath('/my-work')

  return json(200, { ok: true, dry_run: false, ...summary, battery })
}

async function findBySerial(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  serial: string
): Promise<{ id: string; internal_id: string } | null> {
  const { data } = await supabase
    .from('equipment')
    .select('id, internal_id')
    .eq('organization_id', orgId)
    .eq('serial_number', serial)
    .maybeSingle()
  return data
}

/**
 * Adds a powercfg battery report, unless an identical one was already recorded
 * today — re-running the script at the bench should not stack duplicate rows.
 */
async function addBatteryReport(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  equipmentId: string,
  battery: ReportedBattery
): Promise<'added' | 'skipped_duplicate' | 'error'> {
  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await supabase
    .from('battery_reports')
    .select('design_capacity_mwh, full_charge_capacity_mwh, cycle_count')
    .eq('equipment_id', equipmentId)
    .eq('source', 'powercfg')
    .eq('report_date', today)

  const duplicate = (existing ?? []).some(
    (r) =>
      r.design_capacity_mwh === battery.design_capacity_mwh &&
      r.full_charge_capacity_mwh === battery.full_charge_capacity_mwh &&
      r.cycle_count === battery.cycle_count
  )
  if (duplicate) return 'skipped_duplicate'

  const { error } = await supabase.from('battery_reports').insert({
    organization_id: orgId,
    equipment_id: equipmentId,
    report_date: today,
    design_capacity_mwh: battery.design_capacity_mwh,
    full_charge_capacity_mwh: battery.full_charge_capacity_mwh,
    cycle_count: battery.cycle_count,
    estimated_runtime_minutes: battery.estimated_runtime_minutes,
    source: 'powercfg',
    created_by_user_id: null,
  })
  return error ? 'error' : 'added'
}
