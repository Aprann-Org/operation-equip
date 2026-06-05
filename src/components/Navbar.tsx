import { signOut } from '@/app/actions'
import type { UserContext } from '@/lib/auth'
import styles from './Navbar.module.css'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Admin',
  technician: 'Technician',
  recipient: 'Recipient',
}

type Props = { ctx: UserContext }

export default function Navbar({ ctx }: Props) {
  return (
    <nav className={styles.nav}>
      <div className={styles.left}>
        <a href={ctx.isRecipient ? '/my-equipment' : '/'} className={styles.brand}>
          <span className={styles.logoMark}>OE</span>
          <span className={styles.brandName}>Operation Equip</span>
        </a>

        <ul className={styles.links}>
          {ctx.isRecipient ? (
            <>
              <li><a href="/my-equipment">My Equipment</a></li>
              <li><a href="/support">Support</a></li>
            </>
          ) : (
            <>
              <li><a href="/">Dashboard</a></li>
              <li><a href="/equipment">Equipment</a></li>
              <li><a href="/organizations">Organizations</a></li>
              <li><a href="/support">Support</a></li>
              {ctx.canManageSettings && (
                <li><a href="/settings/users">Settings</a></li>
              )}
            </>
          )}
        </ul>
      </div>

      <div className={styles.right}>
        <div className={styles.userInfo}>
          <span className={styles.userEmail}>{ctx.email}</span>
          {ctx.organizationName && (
            <span className={styles.orgName}>{ctx.organizationName}</span>
          )}
        </div>
        <span className={`badge badge-${ctx.role}`} style={{ fontSize: 11 }}>
          {ROLE_LABELS[ctx.role] ?? ctx.role}
        </span>
        <form action={signOut}>
          <button type="submit" className={styles.signOutBtn}>Sign out</button>
        </form>
      </div>
    </nav>
  )
}
