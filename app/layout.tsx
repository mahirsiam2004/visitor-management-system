import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'SecureEntry - Visitor Management System',
    template: '%s | SecureEntry',
  },
  description: 'Enterprise-grade visitor management system for residential buildings. Manage guest passes, track entries, and ensure building security.',
  keywords: ['visitor management', 'guest pass', 'building security', 'QR code', 'residential'],
  authors: [{ name: 'SecureEntry' }],
  robots: 'noindex, nofollow',
  icons: {
    icon: '/icon.svg',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: [{ color: '#ffffff' }],
  userScalable: true,
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        className="antialiased bg-white text-slate-900 font-sans"
        suppressHydrationWarning
      >
        {children}
        <Toaster
          position="top-center"
          expand={false}
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
          }}
        />
      </body>
    </html>
  )
}
