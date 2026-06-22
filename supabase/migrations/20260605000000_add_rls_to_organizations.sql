-- =============================================================
-- Add RLS to tables that were left unprotected in the initial
-- schema: organizations and equipment_types.
-- =============================================================

-- ── organizations ─────────────────────────────────────────────
alter table organizations enable row level security;

-- Any authenticated user can read organizations (needed for form
-- pickers — donor/recipient dropdowns, dashboard counts, etc.)
create policy "Authenticated users can read organizations"
  on organizations for select
  using (auth.uid() is not null);

-- Super admins can do anything; org admins can update their own org.
create policy "Admins can insert organizations"
  on organizations for insert
  with check (is_super_admin() or has_role_in_org(id, 'org_admin'));

create policy "Admins can update their organization"
  on organizations for update
  using (
    is_super_admin()
    or has_role_in_org(id, 'org_admin')
  );

create policy "Only super admins can delete organizations"
  on organizations for delete
  using (is_super_admin());


-- ── equipment_types ───────────────────────────────────────────
alter table equipment_types enable row level security;

-- All authenticated users can read equipment types (needed for
-- type pickers in equipment forms and checklist templates).
create policy "Authenticated users can read equipment types"
  on equipment_types for select
  using (auth.uid() is not null);

-- Only super admins may add/modify equipment types (global catalog).
create policy "Super admins can manage equipment types"
  on equipment_types for insert
  with check (is_super_admin());

create policy "Super admins can update equipment types"
  on equipment_types for update
  using (is_super_admin());

create policy "Super admins can delete equipment types"
  on equipment_types for delete
  using (is_super_admin());
