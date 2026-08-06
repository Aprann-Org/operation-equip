-- =============================================================
-- Make role assignment work without the SQL editor.
--
-- Three defects fixed here:
--
-- 1. Invited users never got a role. The auth callback inserts into
--    user_roles as the *invitee*, but the "Admins can manage roles in
--    their org" policy requires the caller to already be an org_admin
--    or super_admin. A brand-new invitee is neither, so the insert was
--    rejected by RLS and they landed on /setup. The role is now created
--    by the security-definer signup trigger from the invite metadata.
--
-- 2. Org admins could not read other users' profiles. The only SELECT
--    policy on users was `id = auth.uid() or is_super_admin()`, so the
--    Users & Roles table rendered "—" for every member's email.
--
-- 3. Changing a role stacked instead of replacing. user_roles is unique
--    on (user_id, organization_id, role), so an upsert with a *new* role
--    never conflicts — it inserts a second row and the user keeps both.
--    Demotions silently did nothing because ROLE_PRIORITY picks the
--    highest. set_user_role() now replaces atomically.
--
-- Also adds pending_users(): role-less accounts, so admins can grant
-- access from the UI instead of hand-writing INSERTs.
-- =============================================================


-- =============================================================
-- HELPERS
-- =============================================================

-- Org IDs where the current user is an org_admin. Security definer so
-- it can read user_roles without tripping that table's own policies.
create or replace function my_admin_organization_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id
  from user_roles
  where user_id = auth.uid()
    and role = 'org_admin'
    and organization_id is not null
$$;

-- Is the current user an admin anywhere at all? Gates the pending list,
-- which by definition has no org to scope against.
create or replace function is_any_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and role in ('super_admin', 'org_admin')
  )
$$;

-- Does p_user_id hold a role in an org the current user administers?
create or replace function shares_admin_org(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = p_user_id
      and organization_id in (select my_admin_organization_ids())
  )
$$;


-- =============================================================
-- 1. INVITED USERS GET THEIR ROLE AT SIGNUP
-- =============================================================

create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role   text := new.raw_user_meta_data->>'invited_role';
  v_org_id text := new.raw_user_meta_data->>'invited_org_id';
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

  -- Apply the role the inviting admin chose. Runs as definer, so it is
  -- not subject to the user_roles admin policy the invitee can't satisfy.
  if v_role is not null and v_org_id is not null then
    insert into public.user_roles (user_id, organization_id, role)
    values (new.id, v_org_id::uuid, v_role::user_role)
    on conflict (user_id, organization_id, role) do nothing;
  end if;

  return new;
end;
$$;

-- Accounts become 'active' when they confirm their email / accept the
-- invite. Nothing set this before, so every user read as 'invited' forever.
create or replace function handle_auth_user_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.users
    set status = 'active'
    where id = new.id
      and status = 'invited';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function handle_auth_user_confirmed();

-- Backfill: anyone who already confirmed before this migration.
update public.users u
set status = 'active'
from auth.users a
where a.id = u.id
  and a.email_confirmed_at is not null
  and u.status = 'invited';


-- =============================================================
-- 2. ADMINS CAN READ THEIR MEMBERS' PROFILES
-- =============================================================

-- Additive: policies OR together, so the existing own-profile and
-- super-admin read paths are untouched.
create policy "Org admins can read users in their organizations"
  on users for select using (shares_admin_org(id));

-- Role-less accounts are visible to any admin. They have no org yet, so
-- there is nothing to scope by — this is the queue an admin triages from.
create policy "Admins can read accounts awaiting a role"
  on users for select using (
    is_any_admin()
    and not exists (select 1 from user_roles r where r.user_id = users.id)
  );


-- =============================================================
-- 3. PENDING QUEUE + ATOMIC ROLE ASSIGNMENT
-- =============================================================

-- Accounts that exist in auth but hold no role anywhere. Returns nothing
-- for non-admins — the guard is inside the function, not the caller.
create or replace function pending_users()
returns table (
  id         uuid,
  first_name text,
  last_name  text,
  email      text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select u.id, u.first_name, u.last_name, u.email, u.created_at
  from users u
  where is_any_admin()
    and not exists (select 1 from user_roles r where r.user_id = u.id)
  order by u.created_at desc
$$;

grant execute on function pending_users() to authenticated;

-- Set a user's single role within one org, replacing whatever they had
-- there. One statement, so the delete and insert are atomic — a failed
-- insert can't leave the user with no role.
--
-- super_admin is deliberately not assignable: those rows carry a null
-- organization_id and are provisioned out of band.
create or replace function set_user_role(
  p_user_id         uuid,
  p_organization_id uuid,
  p_role            user_role
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_organization_id is null then
    raise exception 'An organization is required to assign a role';
  end if;

  if not (is_super_admin() or has_role_in_org(p_organization_id, 'org_admin')) then
    raise exception 'Permission denied';
  end if;

  if p_role = 'super_admin' then
    raise exception 'super_admin cannot be assigned from the app';
  end if;

  delete from user_roles
  where user_id = p_user_id
    and organization_id = p_organization_id;

  insert into user_roles (user_id, organization_id, role)
  values (p_user_id, p_organization_id, p_role);
end;
$$;

grant execute on function set_user_role(uuid, uuid, user_role) to authenticated;
