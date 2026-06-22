import { redirect } from 'next/navigation'
import { getCurrentUserContext } from '@/lib/auth'
import styles from './layout.module.css'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserContext()
  if (!ctx || !ctx.canManageSettings) redirect('/')

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar}>
        <p className={styles.sidebarTitle}>Settings</p>
        <a href="/settings/users" className={styles.sidebarLink}>Users &amp; Roles</a>
        <a href="/settings/checklists" className={styles.sidebarLink}>Checklist Templates</a>
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
