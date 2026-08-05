'use client'

import { useRef } from 'react'
import { setRolePreview } from '@/app/actions'
import { ROLE_LABELS } from '@/lib/role-preview'
import type { UserRole } from '@/lib/types'
import styles from './Navbar.module.css'

type Props = {
  realRole: UserRole
  currentRole: UserRole
  options: UserRole[]
}

export default function RoleSwitcher({ realRole, currentRole, options }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form action={setRolePreview} ref={formRef} className={styles.roleSwitcher}>
      <label htmlFor="role-preview" className={styles.roleSwitcherLabel}>View as</label>
      <select
        id="role-preview"
        name="role"
        key={currentRole}
        defaultValue={currentRole}
        onChange={() => formRef.current?.requestSubmit()}
        className={styles.roleSelect}
      >
        <option value={realRole}>{ROLE_LABELS[realRole]} (you)</option>
        {options.map(r => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
    </form>
  )
}
