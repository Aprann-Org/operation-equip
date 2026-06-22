import { createClient } from '@supabase/supabase-js'

// Uses the service role key — server-side only, never expose to the client.
// Required for: inviting users, reading all auth users.
// Set SUPABASE_SERVICE_ROLE_KEY in .env.local to enable these features.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local to enable user invitation.'
    )
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
