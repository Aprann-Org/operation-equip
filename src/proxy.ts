import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth']

// Routes recipients must not access — redirect them to their portal
const RECIPIENT_BLOCKED = [
  '/equipment/new',
  '/equipment/',     // individual device pages they don't own (RLS handles data; this handles UI)
  '/organizations',
  '/settings',
]

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function applySecurityHeaders(response: NextResponse) {
  response.headers.set('Content-Security-Policy', CSP)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return response
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p))

  if (!user && !isPublic) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/login', request.url)))
  }

  if (user && path === '/login') {
    return applySecurityHeaders(NextResponse.redirect(new URL('/', request.url)))
  }

  // Role-based route guard: recipients only access /my-equipment and /support
  if (user && RECIPIENT_BLOCKED.some((p) => path.startsWith(p))) {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .neq('role', 'recipient')
      .limit(1)

    // If no non-recipient role found, this user is purely a recipient
    if (!roles?.length) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL('/my-equipment', request.url))
      )
    }
  }

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
