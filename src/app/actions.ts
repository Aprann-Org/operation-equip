'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth'
import { ROLE_PREVIEW_COOKIE, isValidPreview, landingPathFor } from '@/lib/role-preview'

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  ;(await cookies()).delete(ROLE_PREVIEW_COOKIE)
  redirect('/login')
}

/**
 * Switch which role the UI renders for. Authorized against the *real* role so a
 * previewing admin can always switch again (or back), and so nobody can preview
 * upward. Data access is unaffected — RLS still uses the real role.
 */
export async function setRolePreview(formData: FormData) {
  const ctx = await getCurrentUserContext()
  if (!ctx) redirect('/login')

  const requested = formData.get('role') as string | null
  const cookieStore = await cookies()

  // Selecting your own role means "stop previewing"
  if (!requested || requested === ctx.realRole) {
    cookieStore.delete(ROLE_PREVIEW_COOKIE)
    revalidatePath('/', 'layout')
    redirect(landingPathFor(ctx.realRole))
  }

  if (!isValidPreview(ctx.realRole, requested)) {
    throw new Error('Permission denied')
  }

  cookieStore.set(ROLE_PREVIEW_COOKIE, requested, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8, // preview lapses after a working day
  })
  revalidatePath('/', 'layout')
  redirect(landingPathFor(requested))
}

export async function clearRolePreview() {
  const ctx = await getCurrentUserContext()
  if (!ctx) redirect('/login')

  ;(await cookies()).delete(ROLE_PREVIEW_COOKIE)
  revalidatePath('/', 'layout')
  redirect(landingPathFor(ctx.realRole))
}
