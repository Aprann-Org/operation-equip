import { getCurrentUserContext } from '@/lib/auth'
import { signOut } from '@/app/actions'
import { UuidField } from './UuidField'
import styles from './page.module.css'

export const metadata = { title: 'Account Setup — Operation Equip' }

export default async function SetupPage() {
  const ctx = await getCurrentUserContext()

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logoMark}>OE</span>
          <span className={styles.brandName}>Operation Equip</span>
        </div>

        <h1 className={styles.title}>Account not configured</h1>
        <p className={styles.subtitle}>
          You&apos;re signed in as <strong>{ctx?.email}</strong>, but this account hasn&apos;t been
          assigned a role yet. Ask your Organization Admin to invite you via
          <strong> Settings → Users &amp; Roles</strong>, or run the SQL below in
          the <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className={styles.link}>Supabase SQL Editor</a>.
        </p>

        <div className={styles.sqlBlock}>
          <p className={styles.sqlLabel}>Your user ID — copy this exact value</p>
          <UuidField value={ctx?.userId ?? ''} />
        </div>

        <div className={styles.sqlBlock}>
          <p className={styles.sqlLabel}>Assign yourself as Org Admin of Aprann</p>
          <pre className={styles.sql}>{`INSERT INTO user_roles (user_id, organization_id, role)
SELECT
  '${ctx?.userId}',
  id,
  'org_admin'
FROM organizations
WHERE name = 'Aprann'
ON CONFLICT DO NOTHING;`}</pre>
          <p className={styles.sqlHint}>
            Run this in your Supabase project&apos;s SQL Editor, then sign out and sign back in.
          </p>
        </div>

        <form action={signOut} style={{ marginTop: 8 }}>
          <button type="submit" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
