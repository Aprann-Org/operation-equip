import type { Metadata } from 'next'
import { getCurrentUserContext } from '@/lib/auth'
import Navbar from '@/components/Navbar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Operation Equip',
  description: 'Track equipment from acquisition to delivery',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUserContext()

  return (
    <html lang="en">
      <body>
        {ctx && <Navbar ctx={ctx} />}
        {children}
      </body>
    </html>
  )
}
