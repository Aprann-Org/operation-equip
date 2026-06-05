import { signOut } from '@/app/actions'
import styles from './Navbar.module.css'

type Props = {
  userEmail: string
}

export default function Navbar({ userEmail }: Props) {
  return (
    <nav className={styles.nav}>
      <div className={styles.left}>
        <a href="/" className={styles.brand}>
          <span className={styles.logoMark}>OE</span>
          <span className={styles.brandName}>Operation Equip</span>
        </a>
        <ul className={styles.links}>
          <li><a href="/">Dashboard</a></li>
          <li><a href="/equipment">Equipment</a></li>
          <li><a href="/organizations">Organizations</a></li>
          <li><a href="/support">Support</a></li>
        </ul>
      </div>

      <div className={styles.right}>
        <span className={styles.userEmail}>{userEmail}</span>
        <form action={signOut}>
          <button type="submit" className={styles.signOutBtn}>Sign out</button>
        </form>
      </div>
    </nav>
  )
}
