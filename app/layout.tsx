import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'SecureEntry - Visitor Management System',
    template: '%s | SecureEntry',
  },
  description: 'Enterprise-grade visitor management system for residential buildings. Manage guest passes, track entries, and ensure building security.',
  keywords: ['visitor management', 'guest pass', 'building security', 'QR code', 'residential'],
  authors: [{ name: 'Mahir Siam' }],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'SecureEntry - Visitor Management System',
    description:
      'Modern visitor management for residential communities — QR guest passes, guard verification, and admin analytics.',
    type: 'website',
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
    shortcut: '/logo.png',
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
    <html lang="en" className={`light ${poppins.variable}`} suppressHydrationWarning>
      <body
        className="antialiased bg-white text-slate-900"
        style={{ fontFamily: 'var(--font-poppins), Poppins, system-ui, sans-serif' }}
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
