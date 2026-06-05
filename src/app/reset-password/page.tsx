import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { updatePassword } from './actions'
import styles from './page.module.css'

export const metadata = { title: 'Set New Password — Operation Equip' }

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  // Must have an active recovery session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=Reset+link+expired.+Request+a+new+one.')

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logoMark}>OE</span>
          <span className={styles.brandName}>Operation Equip</span>
        </div>

        <h1 className={styles.title}>Set new password</h1>
        <p className={styles.subtitle}>Choose a strong password — at least 8 characters.</p>

        {error && <p className="form-error">{decodeURIComponent(error)}</p>}

        <form action={updatePassword}>
          <div className="field">
            <label className="label" htmlFor="password">New password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="input"
              placeholder="••••••••"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="input"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
            Update password
          </button>
        </form>
      </div>
    </div>
  )
}
