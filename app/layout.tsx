import type { Metadata, Viewport } from 'next'
import { Poppins, Noto_Sans_Bengali } from 'next/font/google'
import { Toaster } from 'sonner'
import OfflineBanner from '@/components/features/OfflineBanner'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
})

const notoBengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bengali',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'SecureEntry - Visitor Management System',
    template: '%s | SecureEntry',
  },
  description: 'Visitor management system for residential buildings in Bangladesh.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'SecureEntry' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
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
    <html lang="en" className={`light ${poppins.variable} ${notoBengali.variable}`} suppressHydrationWarning>
      <body
        className="antialiased bg-white text-slate-900"
        style={{ fontFamily: 'var(--font-poppins), var(--font-bengali), system-ui, sans-serif' }}
        suppressHydrationWarning
      >
        <OfflineBanner />
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
