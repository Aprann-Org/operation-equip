'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get('email') as string).trim().toLowerCase()
  if (!email) redirect('/forgot-password?error=Email+is+required')

  const supabase = await createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Always show success regardless of whether the email exists —
  // prevents user enumeration attacks.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  })

  redirect('/forgot-password?sent=1')
}
