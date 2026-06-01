-- =============================================================
-- Operation Equip — v1 Initial Schema
-- =============================================================

-- =============================================================
-- EXTENSIONS
-- =============================================================

create extension if not exists "pgcrypto";


-- =============================================================
-- ENUMS
-- =============================================================

create type org_type as enum ('tenant', 'donor', 'recipient', 'both');
create type org_status as enum ('active', 'archived');

create type user_status as enum ('invited', 'active', 'suspended');
create type user_role as enum ('super_admin', 'org_admin', 'technician', 'recipient');

create type equipment_stage as enum (
  'acquired',
  'received',
  'in_process',
  'ready_for_distribution',
  'distributed',
  'in_support',
  'retired'
);

create type equipment_sub_status as enum (
  'testing',
  'repairing',
  'awaiting_parts',
  'awaiting_software',
  'final_qa',
  'blocked'
);

create type cosmetic_condition as enum ('good', 'fair', 'poor');
create type disk_type as enum ('ssd', 'hdd', 'nvme');

create type retirement_reason as enum (
  'lost',
  'broken',
  'returned_to_donor',
  'end_of_life',
  'other'
);

create type battery_source as enum (
  'powercfg',
  'manual',
  'apple_system_info',
  'other'
);

create type checklist_result_type as enum ('boolean', 'text', 'numeric');
create type note_visibility as enum ('internal', 'recipient_visible');

create type support_thread_status as enum (
  'open',
  'awaiting_recipient',
  'awaiting_tech',
  'resolved',
  'closed'
);


-- =============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =============================================================
-- ORGANIZATIONS
-- Global table — no organization_id. Serves as tenants, donors,
-- and recipient orgs via the `type` field.
-- =============================================================

create table organizations (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  type             org_type    not null,
  status           org_status  not null default 'active',
  ein              text,
  key_contact_name  text,
  key_contact_email text,
  address          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger set_updated_at
  before update on organizations
  for each row execute function set_updated_at();


-- =============================================================
-- USERS
-- Extends auth.users. Populated via trigger on auth.users insert.
-- =============================================================

create table users (
  id         uuid        primary key references auth.users(id) on delete cascade,
  first_name text        not null default '',
  last_name  text        not null default '',
  email      text        not null unique,
  status     user_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- Auto-create a users row when Supabase Auth creates a new user
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, first_name, last_name, email, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    'invited'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();


-- =============================================================
-- USER ROLES
-- Many-to-many: user <-> organization <-> role.
-- organization_id is null for super_admin.
-- =============================================================

create table user_roles (
  id              uuid      primary key default gen_random_uuid(),
  user_id         uuid      not null references users(id) on delete cascade,
  organization_id uuid      references organizations(id) on delete cascade,
  role            user_role not null,
  created_at      timestamptz not null default now(),
  unique (user_id, organization_id, role)
);


-- =============================================================
-- EQUIPMENT TYPES
-- Global (not per-tenant). spec_schema is a JSON Schema object
-- that defines valid keys/types for the specs JSONB column on
-- equipment rows of this type.
-- =============================================================

create table equipment_types (
  id          uuid  primary key default gen_random_uuid(),
  name        text  not null unique,
  spec_schema jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger set_updated_at
  before update on equipment_types
  for each row execute function set_updated_at();


-- =============================================================
-- EQUIPMENT
-- Core table. One row per physical device.
-- Hybrid spec storage: processor/ram_gb/disk_capacity_gb are
-- promoted to real columns for easy querying; all other
-- type-specific fields live in specs JSONB.
-- windows_key and office_key are stored in specs — ensure
-- application-layer encryption before write (e.g. Supabase Vault).
-- =============================================================

create table equipment (
  id                         uuid               primary key default gen_random_uuid(),
  organization_id            uuid               not null references organizations(id),
  equipment_type_id          uuid               not null references equipment_types(id),

  -- Identity
  internal_id                text               not null,

  -- Provenance
  donor_organization_id      uuid               references organizations(id),
  source_detail              text,
  sponsor_name               text,
  sponsor_email              text,

  -- Hardware (common promoted fields — hybrid approach)
  make                       text,
  model                      text,
  processor                  text,
  ram_gb                     integer,
  disk_capacity_gb           integer,

  -- Type-specific fields (JSON Schema validated at app layer)
  -- Laptop keys: disk_type, screen_size_in, os, windows_key,
  --              office_key, bios_version, bios_date
  specs                      jsonb,

  -- Condition
  cosmetic_condition         cosmetic_condition,
  cosmetic_notes             text,

  -- Lifecycle
  stage                      equipment_stage    not null default 'acquired',
  sub_status                 equipment_sub_status,   -- only set when stage = in_process
  assigned_technician_id     uuid               references users(id),
  tech_due_date              date,

  -- Destination
  destination_organization_id uuid              references organizations(id),
  destination_person_id      uuid               references users(id),

  -- Key dates
  date_acquired              date,
  date_received              date,
  date_sent                  date,
  date_delivered             date,

  -- Retirement
  retirement_reason          retirement_reason,
  retirement_notes           text,

  -- Audit
  created_at                 timestamptz        not null default now(),
  updated_at                 timestamptz        not null default now(),
  created_by_user_id         uuid               references users(id),

  unique (organization_id, internal_id)
);

create index equipment_organization_id_idx          on equipment (organization_id);
create index equipment_stage_idx                    on equipment (stage);
create index equipment_assigned_technician_id_idx   on equipment (assigned_technician_id);
create index equipment_destination_organization_idx on equipment (destination_organization_id);
create index equipment_destination_person_idx       on equipment (destination_person_id);
create index equipment_specs_gin_idx                on equipment using gin (specs);

create trigger set_updated_at
  before update on equipment
  for each row execute function set_updated_at();


-- =============================================================
-- STAGE HISTORY
-- Append-only audit log of lifecycle transitions.
-- =============================================================

create table stage_history (
  id              uuid            primary key default gen_random_uuid(),
  organization_id uuid            not null references organizations(id),
  equipment_id    uuid            not null references equipment(id) on delete cascade,
  from_stage      equipment_stage,               -- null on initial entry
  to_stage        equipment_stage not null,
  user_id         uuid            references users(id),
  occurred_at     timestamptz     not null default now(),
  reason          text,
  created_at      timestamptz     not null default now()
);

create index stage_history_equipment_id_idx on stage_history (equipment_id);
create index stage_history_occurred_at_idx  on stage_history (occurred_at);


-- =============================================================
-- EQUIPMENT NOTES
-- Free-text notes. Separate from structured checklist results.
-- =============================================================

create table equipment_notes (
  id              uuid             primary key default gen_random_uuid(),
  organization_id uuid             not null references organizations(id),
  equipment_id    uuid             not null references equipment(id) on delete cascade,
  user_id         uuid             not null references users(id),
  note            text             not null,
  visibility      note_visibility  not null default 'internal',
  created_at      timestamptz      not null default now(),
  updated_at      timestamptz      not null default now()
);

create index equipment_notes_equipment_id_idx on equipment_notes (equipment_id);

create trigger set_updated_at
  before update on equipment_notes
  for each row execute function set_updated_at();


-- =============================================================
-- BATTERY REPORTS
-- One per device per report event; multiple allowed over lifetime.
-- percent_of_design is a generated column (full / design * 100).
-- =============================================================

create table battery_reports (
  id                        uuid           primary key default gen_random_uuid(),
  organization_id           uuid           not null references organizations(id),
  equipment_id              uuid           not null references equipment(id) on delete cascade,
  report_date               date           not null,
  design_capacity_mwh       integer,
  full_charge_capacity_mwh  integer,
  cycle_count               integer,
  percent_of_design         numeric(5,2)   generated always as (
    case
      when design_capacity_mwh is not null
       and design_capacity_mwh > 0
       and full_charge_capacity_mwh is not null
      then round((full_charge_capacity_mwh::numeric / design_capacity_mwh) * 100, 2)
      else null
    end
  ) stored,
  estimated_runtime_minutes integer,
  measured_runtime_minutes  integer,
  source                    battery_source not null,
  raw_report_url            text,
  created_at                timestamptz    not null default now(),
  updated_at                timestamptz    not null default now(),
  created_by_user_id        uuid           references users(id)
);

create index battery_reports_equipment_id_idx on battery_reports (equipment_id);

create trigger set_updated_at
  before update on battery_reports
  for each row execute function set_updated_at();


-- =============================================================
-- CHECKLIST TEMPLATES
-- One active template per org + equipment type at a time.
-- Version is incremented on changes; results record which
-- version they were filled against via checklist_item_id.
-- =============================================================

create table checklist_templates (
  id                uuid    primary key default gen_random_uuid(),
  organization_id   uuid    not null references organizations(id),
  equipment_type_id uuid    not null references equipment_types(id),
  name              text    not null,
  version           integer not null default 1,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by_user_id uuid   references users(id)
);

-- Enforce one active template per org + type
create unique index checklist_templates_one_active_per_type
  on checklist_templates (organization_id, equipment_type_id)
  where is_active = true;

create trigger set_updated_at
  before update on checklist_templates
  for each row execute function set_updated_at();


-- =============================================================
-- CHECKLIST ITEMS
-- Ordered items within a template.
-- =============================================================

create table checklist_items (
  id                    uuid                  primary key default gen_random_uuid(),
  checklist_template_id uuid                  not null references checklist_templates(id) on delete cascade,
  "order"               integer               not null,
  label                 text                  not null,
  result_type           checklist_result_type not null,
  required              boolean               not null default true,
  help_text             text,
  created_at            timestamptz           not null default now(),
  updated_at            timestamptz           not null default now(),
  unique (checklist_template_id, "order")
);

create trigger set_updated_at
  before update on checklist_items
  for each row execute function set_updated_at();


-- =============================================================
-- CHECKLIST RESULTS
-- The filled-out instance per device per checklist item.
-- One of result_boolean / result_text / result_numeric is
-- populated depending on the item's result_type.
-- =============================================================

create table checklist_results (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references organizations(id),
  equipment_id      uuid        not null references equipment(id) on delete cascade,
  checklist_item_id uuid        not null references checklist_items(id),
  technician_id     uuid        not null references users(id),
  completed_at      timestamptz not null default now(),
  result_boolean    boolean,
  result_text       text,
  result_numeric    numeric,
  resolution_notes  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (equipment_id, checklist_item_id)
);

create index checklist_results_equipment_id_idx on checklist_results (equipment_id);

create trigger set_updated_at
  before update on checklist_results
  for each row execute function set_updated_at();


-- =============================================================
-- SUPPORT THREADS
-- Lightweight per-device issue threads.
-- =============================================================

create table support_threads (
  id                 uuid                  primary key default gen_random_uuid(),
  organization_id    uuid                  not null references organizations(id),
  equipment_id       uuid                  not null references equipment(id) on delete cascade,
  opened_by_user_id  uuid                  not null references users(id),
  subject            text                  not null,
  status             support_thread_status not null default 'open',
  opened_at          timestamptz           not null default now(),
  closed_at          timestamptz,
  created_at         timestamptz           not null default now(),
  updated_at         timestamptz           not null default now()
);

create index support_threads_equipment_id_idx on support_threads (equipment_id);
create index support_threads_status_idx       on support_threads (status);

create trigger set_updated_at
  before update on support_threads
  for each row execute function set_updated_at();


-- =============================================================
-- SUPPORT MESSAGES
-- Individual messages within a support thread.
-- =============================================================

create table support_messages (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references organizations(id),
  support_thread_id uuid        not null references support_threads(id) on delete cascade,
  user_id           uuid        not null references users(id),
  body              text        not null,
  sent_at           timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index support_messages_thread_id_idx on support_messages (support_thread_id);


-- =============================================================
-- ROW-LEVEL SECURITY
-- =============================================================

alter table users             enable row level security;
alter table user_roles        enable row level security;
alter table equipment         enable row level security;
alter table stage_history     enable row level security;
alter table equipment_notes   enable row level security;
alter table battery_reports   enable row level security;
alter table checklist_templates enable row level security;
alter table checklist_items   enable row level security;
alter table checklist_results enable row level security;
alter table support_threads   enable row level security;
alter table support_messages  enable row level security;

-- Helper: org IDs the current user belongs to (security definer
-- so the query on user_roles bypasses its own RLS)
create or replace function my_organization_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id
  from user_roles
  where user_id = auth.uid()
    and organization_id is not null
$$;

-- Helper: is the current user a super admin?
create or replace function is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and role = 'super_admin'
  )
$$;

-- Helper: does the current user hold one of the given roles in any org?
create or replace function has_role_in_org(p_org_id uuid, variadic p_roles user_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and organization_id = p_org_id
      and role = any(p_roles)
  )
$$;

-- --- users ---
create policy "Users can read their own profile"
  on users for select using (id = auth.uid() or is_super_admin());

create policy "Users can update their own profile"
  on users for update using (id = auth.uid());

-- --- user_roles ---
create policy "Users can see their own roles; admins see their org's roles"
  on user_roles for select using (
    user_id = auth.uid()
    or is_super_admin()
    or has_role_in_org(organization_id, 'org_admin')
  );

create policy "Admins can manage roles in their org"
  on user_roles for all using (
    is_super_admin()
    or has_role_in_org(organization_id, 'org_admin')
  );

-- --- equipment ---
create policy "Members see equipment in their org"
  on equipment for select using (
    is_super_admin()
    or organization_id in (select my_organization_ids())
  );

create policy "Technicians and admins can insert equipment"
  on equipment for insert with check (
    has_role_in_org(organization_id, 'org_admin', 'technician')
  );

create policy "Technicians and admins can update equipment"
  on equipment for update using (
    is_super_admin()
    or has_role_in_org(organization_id, 'org_admin', 'technician')
  );

-- --- stage_history (insert-only audit log — no updates or deletes) ---
create policy "Members see stage history in their org"
  on stage_history for select using (
    is_super_admin()
    or organization_id in (select my_organization_ids())
  );

create policy "Technicians and admins can insert stage history"
  on stage_history for insert with check (
    has_role_in_org(organization_id, 'org_admin', 'technician')
  );

-- --- equipment_notes ---
create policy "Admins and technicians see all notes; recipients see recipient_visible only"
  on equipment_notes for select using (
    is_super_admin()
    or has_role_in_org(organization_id, 'org_admin', 'technician')
    or (
      organization_id in (select my_organization_ids())
      and visibility = 'recipient_visible'
    )
  );

create policy "Technicians and admins can insert notes"
  on equipment_notes for insert with check (
    has_role_in_org(organization_id, 'org_admin', 'technician')
  );

create policy "Authors can update their own notes"
  on equipment_notes for update using (
    user_id = auth.uid()
    or has_role_in_org(organization_id, 'org_admin')
  );

-- --- battery_reports ---
create policy "Members see battery reports in their org"
  on battery_reports for select using (
    is_super_admin()
    or organization_id in (select my_organization_ids())
  );

create policy "Technicians and admins can manage battery reports"
  on battery_reports for all using (
    is_super_admin()
    or has_role_in_org(organization_id, 'org_admin', 'technician')
  );

-- --- checklist_templates ---
create policy "Members see templates in their org"
  on checklist_templates for select using (
    is_super_admin()
    or organization_id in (select my_organization_ids())
  );

create policy "Admins can manage checklist templates"
  on checklist_templates for all using (
    is_super_admin()
    or has_role_in_org(organization_id, 'org_admin')
  );

-- --- checklist_items (readable by all org members; managed by admins) ---
create policy "Members can read checklist items via their org's templates"
  on checklist_items for select using (
    is_super_admin()
    or exists (
      select 1 from checklist_templates ct
      where ct.id = checklist_template_id
        and ct.organization_id in (select my_organization_ids())
    )
  );

create policy "Admins can manage checklist items"
  on checklist_items for all using (
    is_super_admin()
    or exists (
      select 1 from checklist_templates ct
      where ct.id = checklist_template_id
        and has_role_in_org(ct.organization_id, 'org_admin')
    )
  );

-- --- checklist_results ---
create policy "Members see checklist results in their org"
  on checklist_results for select using (
    is_super_admin()
    or organization_id in (select my_organization_ids())
  );

create policy "Technicians and admins can manage checklist results"
  on checklist_results for all using (
    is_super_admin()
    or has_role_in_org(organization_id, 'org_admin', 'technician')
  );

-- --- support_threads ---
create policy "Members see support threads in their org"
  on support_threads for select using (
    is_super_admin()
    or organization_id in (select my_organization_ids())
  );

create policy "Any org member can open a support thread"
  on support_threads for insert with check (
    organization_id in (select my_organization_ids())
  );

create policy "Techs, admins, and the opener can update threads"
  on support_threads for update using (
    is_super_admin()
    or opened_by_user_id = auth.uid()
    or has_role_in_org(organization_id, 'org_admin', 'technician')
  );

-- --- support_messages ---
create policy "Members see messages in their org"
  on support_messages for select using (
    is_super_admin()
    or organization_id in (select my_organization_ids())
  );

create policy "Any org member can post a message"
  on support_messages for insert with check (
    organization_id in (select my_organization_ids())
  );


-- =============================================================
-- SEED DATA
-- =============================================================

-- Aprann as tenant zero
insert into organizations (name, type, status)
values ('Aprann', 'both', 'active');

-- Equipment types
insert into equipment_types (name, spec_schema) values
(
  'Laptop',
  '{
    "type": "object",
    "properties": {
      "disk_type":      { "type": "string", "enum": ["ssd", "hdd", "nvme"] },
      "screen_size_in": { "type": "number" },
      "os":             { "type": "string" },
      "windows_key":    { "type": "string", "description": "Store encrypted via Supabase Vault" },
      "office_key":     { "type": "string", "description": "Store encrypted via Supabase Vault" },
      "bios_version":   { "type": "string" },
      "bios_date":      { "type": "string", "format": "date" }
    }
  }'::jsonb
),
('Desktop',        null),
('Tablet',         null),
('Monitor',        null),
('Networking Gear', null);

-- Aprann's laptop QA checklist (v1)
with
  aprann      as (select id from organizations  where name = 'Aprann'),
  laptop_type as (select id from equipment_types where name = 'Laptop'),
  tmpl as (
    insert into checklist_templates
      (organization_id, equipment_type_id, name, version, is_active)
    select aprann.id, laptop_type.id, 'Laptop QA — v1', 1, true
    from aprann, laptop_type
    returning id
  )
insert into checklist_items
  (checklist_template_id, "order", label, result_type, required, help_text)
select
  tmpl.id,
  items.ord,
  items.label,
  items.result_type::checklist_result_type,
  true,
  items.help_text
from tmpl,
(values
  (1,  'Power supply connection good',        'boolean', null),
  (2,  'Trackpad functions appropriately',    'boolean', null),
  (3,  'Connects to WiFi',                    'boolean', null),
  (4,  'USB drive step completed',            'boolean', null),
  (5,  'Screen functions normally',           'boolean', null),
  (6,  'Camera works',                        'boolean', 'Try Photo Booth or built-in camera app.'),
  (7,  'Microphone works',                    'boolean', null),
  (8,  'Keyboard functions appropriately',    'boolean', null),
  (9,  'Fans pass test',                      'boolean', null),
  (10, 'Secure boot re-enabled',              'boolean', null),
  (11, 'Windows updates installed',           'boolean', null),
  (12, 'Windows memory diagnostics result',   'text',    'Paste the result summary from mdsched.exe.'),
  (13, 'Computer renamed',                    'boolean', null),
  (14, 'Microsoft Office installed',          'boolean', null),
  (15, 'Google Chrome installed and pinned',  'boolean', null),
  (16, 'Driver updates ran',                  'boolean', null)
) as items(ord, label, result_type, help_text);
