import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUserContext } from '@/lib/auth'
import Navbar from '@/components/Navbar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Operation Equip',
  description: 'Track equipment from acquisition to delivery',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserContext()
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  // Authenticated users with no role yet → setup page
  // Skip the redirect when they're already on /setup to avoid loops
  if (ctx?.noRole && !pathname.startsWith('/setup')) {
    redirect('/setup')
  }

  return (
    <html lang="en">
      <body>
        {ctx && !ctx.noRole && <Navbar ctx={ctx} />}
        {children}
      </body>
    </html>
  )
}
