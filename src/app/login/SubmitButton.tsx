'use client'

import { useFormStatus } from 'react-dom'
import styles from './page.module.css'

export function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      className={styles.submitBtn}
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  )
}
