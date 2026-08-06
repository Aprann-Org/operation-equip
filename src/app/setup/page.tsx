import { getCurrentUserContext } from '@/lib/auth'
import { signOut } from '@/app/actions'
import styles from './page.module.css'

export const metadata = { title: 'Pending Approval — Operation Equip' }

export default async function SetupPage() {
  const ctx = await getCurrentUserContext()

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logoMark}>OE</span>
          <span className={styles.brandName}>Operation Equip</span>
        </div>

        <h1 className={styles.title}>Your account is awaiting approval</h1>
        <p className={styles.subtitle}>
          Thanks for signing up, <strong>{ctx?.email}</strong>. Your account has been created
          and is now in the queue for an administrator to review. Once they grant you access
          you&apos;ll be able to sign in and get started — no further action needed on your end.
        </p>

        <div className={styles.notice}>
          <p className={styles.noticeTitle}>What happens next</p>
          <ol className={styles.steps}>
            <li>An administrator sees your account in Users &amp; Roles.</li>
            <li>They assign your role and organization.</li>
            <li>You sign in again and land straight in the app.</li>
          </ol>
        </div>

        <div className={styles.buttonRow}>
          <a href="/" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
            Check again
          </a>
          <form action={signOut} style={{ flex: 1 }}>
            <button
              type="submit"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
