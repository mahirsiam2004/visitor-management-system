import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Secure VMS — Visitor Management System',
  description:
    'A modern, secure visitor management system for residential complexes and buildings.',
  keywords: ['visitor management', 'security', 'resident', 'QR code', 'guest pass'],
  authors: [{ name: 'Secure VMS' }],
  openGraph: {
    title: 'Secure VMS',
    description: 'Modern visitor management for smart buildings',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-gray-950 text-gray-100`}>
        {children}
        <Toaster
          position="top-right"
          richColors
          theme="dark"
          toastOptions={{
            style: {
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f1f5f9',
            },
          }}
        />
      </body>
    </html>
  );
}
