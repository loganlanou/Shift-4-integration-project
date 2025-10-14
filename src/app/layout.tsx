import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Shift4 Payment Platform',
  description: 'Production-ready Shift4 payment integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
