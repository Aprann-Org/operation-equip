# Database Setup (Dev Sandbox)

Operation Equip uses [Supabase](https://supabase.com) for Postgres, Auth, and row-level security. This guide gets you a personal, free sandbox database that the app can run against locally. Plan on about 15 minutes.

You will:

1. Create a free Supabase account and project
2. Configure Auth URLs
3. Put the keys in `.env.local`
4. Run the migrations
5. Create your first app user and give them access
6. Verify it works

> Use your own sandbox project for development. Don't point your local app at the shared or production project.

---

## 1. Create a Supabase account and project

1. Go to <https://supabase.com> and click **Start your project**. Sign up with GitHub or email.
2. Create an organization if prompted. Choose the **Free** plan.
3. Click **New project** and fill in:
   - **Name:** anything, for example `operation-equip-dev-yourname`
   - **Database password:** click **Generate a password** and save it in a password manager. You only need it if you later connect with `psql` or the Supabase CLI.
   - **Region:** the one closest to you
4. Click **Create new project** and wait 1–2 minutes while it provisions.

Free projects pause after about a week of inactivity. If yours does, open the dashboard and click **Restore project**. Your data is kept.

---

## 2. Configure Auth

The app sends invite and password-reset emails whose links return to `/auth/callback`. Supabase only honors redirect URLs you have allowed.

In the dashboard, go to **Authentication → URL Configuration**:

| Setting           | Value                      |
| ----------------- | -------------------------- |
| **Site URL**      | `http://localhost:3000`    |
| **Redirect URLs** | `http://localhost:3000/**` |

Click **Save**.

Notes:

- The app currently has no self-service sign-up page. Accounts are created by an admin invite or, for your first account, by hand in step 5. You can leave Supabase's other Auth settings at their defaults.
- The built-in Supabase email sender is rate-limited (a few emails per hour) and is meant for testing. That is enough for dev. If you hit the limit, create users by hand in the dashboard (step 5) instead of inviting them.
- If you run the app on another port or host, update both values above and set `NEXT_PUBLIC_APP_URL` (see step 3).

---

## 3. Get your keys and configure `.env.local`

In the dashboard, open **Project Settings → API Keys** (older dashboards: **Project Settings → API**). You need the project URL and two keys.

Create a file named `.env.local` in the **repo root** (next to `package.json`). It is gitignored, so it won't be committed.

```bash
# Project URL. Shown on the API settings page, or under Connect.
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co

# Public key. Safe for the browser; access is limited by RLS.
# "anon" key, or the newer "publishable" key.
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Admin key. Bypasses RLS. SERVER-ONLY. Never expose it or commit it.
# "service_role" key, or the newer "secret" key.
SUPABASE_SERVICE_ROLE_KEY=...

# Optional. Used to build links in invite and password-reset emails.
# Defaults to http://localhost:3000.
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

What each variable does:

| Variable                        | Required                  | Used for                                                                                                                  |
| ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes                       | Every Supabase client (browser, server, proxy)                                                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes                       | Normal, RLS-protected access as the signed-in user                                                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes, for Settings → Users | Inviting users and reading auth users ([admin.ts](../src/utils/supabase/admin.ts)). The rest of the app works without it. |
| `NEXT_PUBLIC_APP_URL`           | No                        | Redirect target in invite and password-reset emails                                                                       |

The code reads only these four variables. If a teammate's `.env.local` also has `POSTGRES_*` or `SUPABASE_JWT_SECRET` entries (a Vercel/Supabase integration adds them), the app ignores them, so you don't need to add them.

**Keep `SUPABASE_SERVICE_ROLE_KEY` secret.** It has full access to your database. If it leaks, rotate it in the dashboard.

Restart `npm run dev` after changing `.env.local`. Next.js reads it only at startup.

---

## 4. Run the migrations

The schema lives in [`supabase/migrations/`](./migrations). The files are timestamp-named and **must run in filename order**:

```
20260520000000_initial_schema.sql        tables, enums, RLS, auth trigger, seed data
20260605000000_add_rls_to_organizations.sql
20260805000000_super_admin_stage_history.sql
20260806000000_pending_user_access.sql
20260915000000_equipment_spec_history.sql
20260924000000_add_in_country_stage.sql
20261023000000_add_shipped_stage.sql
```

Run `ls supabase/migrations` for the current list. New migrations get added over time.

The initial migration also seeds an **Aprann** organization, the **Laptop** equipment type (and other types), and a Laptop QA checklist. You'll use the Aprann org in step 5.

### Option A: SQL Editor (no tooling)

1. In the dashboard, open **SQL Editor → New query**.
2. Open the first migration file, copy its entire contents, paste it into the editor, and click **Run**. Wait for "Success".
3. Repeat for each remaining file, **one file per run, in order**. Don't paste several together. The `add_*_stage` files alter an enum, which is safest as its own run.

If a run errors partway, fix the problem before continuing. Don't skip a file.

### Option B: Supabase CLI (better if you'll add migrations)

```bash
npx supabase init                        # creates supabase/config.toml; keep existing migrations
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF   # the ref is the subdomain of your project URL
npx supabase db push                     # applies pending migrations in order
```

You'll be asked for the database password from step 1. `db push` records what has been applied, so re-running it only applies new migrations.

> Don't mix the options on one project. If you ran files in the SQL Editor, the CLI doesn't know they were applied and will try to re-run them.

### Check that it worked

Open **Table Editor**. You should see tables including `organizations`, `users`, `user_roles`, `equipment`, `equipment_types`, and `checklist_templates`. The `organizations` table should contain one row, **Aprann**.

### Starting over

For a clean slate, go to **Project Settings → General → Delete project**. Then create a new project and repeat from step 1. If you only want to wipe the schema, run this in the SQL Editor, then re-run every migration:

```sql
drop schema public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
```

---

## 5. Create your first app user

There is no sign-up page, and new accounts with no role land on a "Pending approval" screen. So your first account needs to be created in the dashboard and given a role by hand. After that, you can invite and approve everyone else from the app (**Settings → Users & Roles**).

### 5a. Create the auth user

1. Dashboard → **Authentication → Users → Add user → Create new user**.
2. Enter your email and a password.
3. **Check "Auto Confirm User"** so you can sign in without an email.
4. Click **Create user**.

A database trigger ([`handle_new_auth_user`](./migrations/20260520000000_initial_schema.sql)) automatically creates the matching row in `public.users`.

### 5b. Grant yourself the admin role

Open **SQL Editor → New query**, replace the email, and run:

```sql
-- Make this user an org admin of the seeded "Aprann" organization.
insert into user_roles (user_id, organization_id, role)
select u.id, o.id, 'org_admin'
from users u
cross join organizations o
where u.email = 'you@example.com'   -- <-- your email
  and o.name  = 'Aprann';

-- Optional: set your display name.
update users
set first_name = 'Your', last_name = 'Name'
where email = 'you@example.com';
```

Confirm it inserted one row. The result should say `Success. 1 row affected` (or similar). If it affected 0 rows, the email doesn't match the user from 5a, or the migrations didn't seed the Aprann org.

**Why `org_admin` and not `super_admin`?** An `org_admin` of Aprann can use the whole app: equipment, organizations, checklists, and inviting users. A `super_admin` row has no organization attached, so some org-scoped screens have nothing to anchor to. Use `org_admin` unless you specifically need to test super-admin behavior. In that case, add `('super_admin', null)` as a second row for your user, since the app uses the highest role:

```sql
insert into user_roles (user_id, organization_id, role)
select id, null, 'super_admin' from users where email = 'you@example.com';
```

### Roles at a glance

| Role          | Can do                                                              |
| ------------- | ------------------------------------------------------------------- |
| `super_admin` | Everything, across organizations                                    |
| `org_admin`   | Manage equipment, users, checklists, and organizations in their org |
| `technician`  | Work on equipment (stages, hardware, checklists, notes)             |
| `recipient`   | See only their own equipment and support threads (`/my-equipment`)  |

As an admin you can preview the app as a lower role from the UI, which saves creating extra test accounts.

---

## 6. Verify

```bash
npm install
npm run dev
```

1. Open <http://localhost:3000>. You'll be redirected to `/login`.
2. Sign in with the email and password from step 5a.
3. You should land on the dashboard, not the "Your account is awaiting approval" page.
4. Open **Settings → Users & Roles**. You should see yourself listed. If the page warns that the service role key is missing, check `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and restart the dev server.
5. Optional: invite a second email from that page, then open the emailed link. It should return to your local app. If it goes to the wrong host, recheck step 2.

---

## Troubleshooting

| Symptom                                                        | Likely cause and fix                                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redirected to `/login` in a loop, or "Invalid API key"         | Wrong or missing `NEXT_PUBLIC_*` values, or the dev server wasn't restarted after editing `.env.local`                                                                    |
| "Invalid login credentials"                                    | Wrong password, or the user wasn't created with **Auto Confirm User** and is unconfirmed. Open the user in **Authentication → Users** and confirm them, or recreate them. |
| Signed in but see "awaiting approval"                          | The `user_roles` insert in 5b didn't run or matched 0 rows. Check `select * from user_roles;`.                                                                            |
| `relation "…" does not exist` or empty Table Editor            | Migrations weren't run, or ran out of order. See step 4.                                                                                                                  |
| `type "…" already exists` when running a migration             | That file already ran. Skip it and continue with the next one.                                                                                                            |
| `SUPABASE_SERVICE_ROLE_KEY is not set`                         | Add it to `.env.local` and restart `npm run dev`                                                                                                                          |
| Invite or reset email never arrives, or "rate limit exceeded"  | Built-in email is throttled. Wait, or create the user by hand (step 5a).                                                                                                  |
| Email link opens the wrong URL or shows "redirect not allowed" | Fix Site URL and Redirect URLs in step 2, and `NEXT_PUBLIC_APP_URL` if you changed ports                                                                                  |
| Project unreachable after some time                            | Free projects pause when idle. Click **Restore project** in the dashboard.                                                                                                |

---

## Adding new migrations

When you change the schema, add a new file to `supabase/migrations/` named `YYYYMMDDHHMMSS_short_description.sql`, newer than the last one. Never edit a migration that has already been merged. Add a new one instead, so everyone's sandbox can apply the same history in order.
