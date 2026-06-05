import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import Navbar from '@/components/Navbar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Operation Equip',
  description: 'Track equipment from acquisition to delivery',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en">
      <body>
        {user && <Navbar userEmail={user.email ?? ''} />}
        {children}
      </body>
    </html>
  )
}
