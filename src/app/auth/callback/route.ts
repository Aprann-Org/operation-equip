import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // If this was an invited user, create their role from the invitation metadata
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const invitedRole = user.user_metadata?.invited_role as string | undefined
        const invitedOrgId = user.user_metadata?.invited_org_id as string | undefined

        if (invitedRole && invitedOrgId) {
          // Insert role — ignore conflict if already exists
          await supabase.from('user_roles').upsert(
            { user_id: user.id, organization_id: invitedOrgId, role: invitedRole },
            { onConflict: 'user_id,organization_id,role', ignoreDuplicates: true }
          )
        }

        // Route recipients to their portal
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .neq('role', 'recipient')
          .limit(1)

        const isRecipient = !roles?.length
        const destination = isRecipient ? '/my-equipment' : next
        return NextResponse.redirect(`${origin}${destination}`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
