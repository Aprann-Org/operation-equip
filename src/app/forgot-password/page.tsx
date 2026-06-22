import { requestPasswordReset } from './actions'
import styles from './page.module.css'

export const metadata = { title: 'Forgot Password — Operation Equip' }

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>
}) {
  const { sent, error } = await searchParams

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <a href="/login" className={styles.brand}>
          <span className={styles.logoMark}>OE</span>
          <span className={styles.brandName}>Operation Equip</span>
        </a>

        {sent ? (
          <>
            <div className={styles.successIcon}>✉️</div>
            <h1 className={styles.title}>Check your email</h1>
            <p className={styles.subtitle}>
              If that address is registered, you&apos;ll receive a password reset link shortly.
              The link expires in 1 hour.
            </p>
            <a href="/login" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Forgot your password?</h1>
            <p className={styles.subtitle}>
              Enter your email and we&apos;ll send a reset link.
            </p>

            {error && <p className="form-error">{decodeURIComponent(error)}</p>}

            <form action={requestPasswordReset}>
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
              <button type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
                Send reset link
              </button>
            </form>

            <a href="/login" className={styles.backLink}>← Back to sign in</a>
          </>
        )}
      </div>
    </div>
  )
}
