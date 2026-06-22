'use client'

import styles from './page.module.css'

export function UuidField({ value }: { value: string }) {
  return (
    <input
      readOnly
      className={styles.userId}
      value={value}
      onFocus={e => e.currentTarget.select()}
    />
  )
}
