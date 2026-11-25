-- =============================================================
-- Intake autofill: hardware identity + intake API keys
--
-- A PowerShell script run on a laptop reads its specs and POSTs
-- them to /api/intake/autofill, which fills in the device's blank
-- hardware fields. Two pieces are needed for that:
--
-- 1. A hardware identity that cannot be mistyped. The physical
--    sticker number (internal_id) is typed in by a person; the
--    manufacturer serial and SMBIOS UUID are read from the BIOS.
--    The first scan links them to the device, and every later scan
--    must agree — so a mistyped sticker number is rejected rather
--    than overwriting some other laptop's record.
--
-- 2. API keys. The script runs on a bare laptop with no browser
--    session, so it authenticates with a per-org bearer key. Only a
--    SHA-256 hash of the key is stored; the key itself is shown once
--    when an admin creates it.
-- =============================================================


-- --- equipment hardware identity ---

alter table equipment
  add column serial_number text,
  add column hardware_uuid text;

-- One serial per org. NULLs are distinct, so unscanned devices are
-- unaffected. hardware_uuid is deliberately NOT unique: some cheap
-- boards ship with the same placeholder UUID, and a collision there
-- must not block intake of a legitimate laptop. The serial is the
-- cross-device check; the UUID only has to match its own device.
create unique index equipment_org_serial_number_key
  on equipment (organization_id, serial_number);
create index equipment_hardware_uuid_idx on equipment (hardware_uuid);

-- Technicians can update equipment rows under RLS, but the hardware
-- identity is admin-only once set: changing it re-points which
-- physical laptop a record belongs to. Requests with no auth.uid()
-- are the service role (the intake API, which links a device on its
-- first scan) and are allowed through.
create or replace function guard_equipment_hardware_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.serial_number is distinct from old.serial_number
      or new.hardware_uuid is distinct from old.hardware_uuid)
     and auth.uid() is not null
     and not (is_super_admin() or has_role_in_org(old.organization_id, 'org_admin'))
  then
    raise exception 'Only admins can change a device''s serial number or hardware UUID'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_hardware_identity
  before update on equipment
  for each row execute function guard_equipment_hardware_identity();


-- --- intake API keys ---

create table intake_api_keys (
  id                 uuid        primary key default gen_random_uuid(),
  organization_id    uuid        not null references organizations(id),
  label              text        not null,
  -- First characters of the key, shown in the list so a key on a
  -- USB stick can be matched to its row. Not enough to use it.
  key_prefix         text        not null,
  -- Hex SHA-256 of the full key. The key is 256 random bits, so an
  -- unsalted fast hash is sufficient.
  key_hash           text        not null unique,
  created_by_user_id uuid        references users(id),
  created_at         timestamptz not null default now(),
  last_used_at       timestamptz,
  revoked_at         timestamptz
);

create index intake_api_keys_organization_id_idx on intake_api_keys (organization_id);

alter table intake_api_keys enable row level security;

-- Admins manage their own org's keys. No delete policy: a key is
-- revoked, never removed, so the list keeps a trail of what existed.
-- The API route looks keys up with the service role, not these.
create policy "Admins see intake keys in their org"
  on intake_api_keys for select using (
    is_super_admin()
    or has_role_in_org(organization_id, 'org_admin')
  );

create policy "Admins can create intake keys"
  on intake_api_keys for insert with check (
    is_super_admin()
    or has_role_in_org(organization_id, 'org_admin')
  );

create policy "Admins can revoke intake keys"
  on intake_api_keys for update using (
    is_super_admin()
    or has_role_in_org(organization_id, 'org_admin')
  );
