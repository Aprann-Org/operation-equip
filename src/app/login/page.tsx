import { signIn } from '@/app/actions'
import styles from './page.module.css'
import SplashScreen from './SplashScreen'
import { SubmitButton } from './SubmitButton'
import HeroSlides from './HeroSlides'

export const metadata = { title: 'Sign In — Operation Equip' }

function safeDecode(s: string) {
  try { return decodeURIComponent(s) } catch { return s }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams

  return (
    <div className={styles.page}>
      <SplashScreen />
      <div className={styles.hero} aria-hidden="true">
        <HeroSlides />
      </div>

      <main className={styles.panel}>
        <div className={styles.formWrap}>
          <div className={styles.brand}>
            <span className={styles.logoMark}>OE</span>
            <div className={styles.brandText}>
              <span className={styles.brandName}>Operation Equip</span>
              <span className={styles.brandSub}>Aprann · Haiti</span>
            </div>
          </div>

          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Sign in to your account to continue.</p>

          {message && (
            <p className={styles.formSuccess}>
              {safeDecode(message)}
            </p>
          )}
          {error && <p className="form-error">{safeDecode(error)}</p>}

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
                placeholder="you@aprann.org"
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
            <SubmitButton />
            <a href="/forgot-password" className={styles.forgotLink}>
              Forgot password?
            </a>
          </form>
        </div>
      </main>
    </div>
  )
}
