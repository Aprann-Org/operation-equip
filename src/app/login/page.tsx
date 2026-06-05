import { signIn } from '@/app/actions'
import styles from './page.module.css'

export const metadata = {
  title: 'Sign In — Operation Equip',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logoMark}>OE</span>
          <span className={styles.brandName}>Operation Equip</span>
        </div>

        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to your account to continue.</p>

        {error && <p className="form-error">{decodeURIComponent(error)}</p>}

        <form action={signIn}>
          <div className="field">
            <label className="label" htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
