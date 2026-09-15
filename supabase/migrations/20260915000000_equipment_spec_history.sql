-- =============================================================
-- Hardware spec edit history
--
-- Hardware specs were effectively write-once: createEquipment was
-- the only writer of make/model/processor/ram_gb/disk_capacity_gb
-- and the laptop keys inside specs, and the detail page rendered
-- them read-only. Editing them after intake now goes through
-- updateHardware, and every changed field is recorded here so a
-- corrected spec keeps a trail of who changed what, and why.
--
-- One row per changed field, so "when did this device's RAM
-- change" is a single indexed lookup.
--
-- Append-only like stage_history: select and insert policies only,
-- no update or delete. The insert policy admits super admins from
-- the start — the equipment UPDATE policy does, and stage_history
-- had to be patched later (20260805) for exactly that mismatch.
-- =============================================================

create table equipment_spec_history (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id),
  equipment_id    uuid        not null references equipment(id) on delete cascade,

  -- Column name ('ram_gb'), or 'specs.<key>' for a field inside the
  -- specs JSONB ('specs.disk_type'). Not an enum — the laptop spec
  -- keys are an app-layer contract, not a database one.
  field           text        not null,

  -- Values are rendered to text so one column holds every field type.
  -- NULL means the field was empty on that side of the change.
  from_value      text,
  to_value        text,

  user_id         uuid        references users(id),
  occurred_at     timestamptz not null default now(),
  reason          text,
  created_at      timestamptz not null default now()
);

create index equipment_spec_history_equipment_id_idx on equipment_spec_history (equipment_id);
create index equipment_spec_history_occurred_at_idx  on equipment_spec_history (occurred_at);

alter table equipment_spec_history enable row level security;

create policy "Members see spec history in their org"
  on equipment_spec_history for select using (
    is_super_admin()
    or organization_id in (select my_organization_ids())
  );

create policy "Technicians and admins can insert spec history"
  on equipment_spec_history for insert with check (
    is_super_admin()
    or has_role_in_org(organization_id, 'org_admin', 'technician')
  );
