import { clearRolePreview } from '@/app/actions'
import { ROLE_LABELS } from '@/lib/role-preview'
import type { UserContext } from '@/lib/auth'
import styles from './RolePreviewBanner.module.css'

export default function RolePreviewBanner({ ctx }: { ctx: UserContext }) {
  if (!ctx.previewRole) return null

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        Viewing as {ROLE_LABELS[ctx.previewRole]} — your real role is {ROLE_LABELS[ctx.realRole]}.
      </span>
      <span className={styles.note}>
        Navigation and permissions match this role; the data you can read does not change.
      </span>
      <form action={clearRolePreview}>
        <button type="submit" className={styles.exitBtn}>Exit preview</button>
      </form>
    </div>
  )
}
