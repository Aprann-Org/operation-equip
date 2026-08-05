-- =============================================================
-- Let super admins write stage history.
--
-- The equipment UPDATE policy admits super admins via is_super_admin(),
-- but the stage_history INSERT policy only checks has_role_in_org(),
-- which matches org_admin/technician rows. A super admin changing a
-- device's stage therefore had the update succeed while the audit-log
-- insert was silently rejected by RLS — losing the transition record.
-- This affects both the single-device stage change and the new batch
-- edit on /equipment.
-- =============================================================

drop policy if exists "Technicians and admins can insert stage history" on stage_history;

create policy "Technicians and admins can insert stage history"
  on stage_history for insert
  with check (
    is_super_admin()
    or has_role_in_org(organization_id, 'org_admin', 'technician')
  );
