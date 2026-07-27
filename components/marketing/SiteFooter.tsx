import Link from 'next/link'
import { QrCode, ShieldCheck, Mail, GitBranch, ArrowUpRight } from 'lucide-react'
import Logo from '@/components/ui/Logo'

const footerSections = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Services', href: '/services' },
      { label: 'About', href: '/about' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Get started', href: '/auth/sign-up' },
      { label: 'Sign in', href: '/auth/login' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'QR guest passes', href: '/#features' },
      { label: 'Security control', href: '/#features' },
      { label: 'Analytics', href: '/#features' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo size="sm" />
              <span className="text-lg font-bold tracking-tight text-slate-900">
                SecureEntry
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
              A modern visitor management system for residential communities —
              QR guest passes, real-time security verification, and powerful
              admin controls in one place.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://github.com/mahirsiam2004/visitor-management-system"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600"
                aria-label="GitHub repository"
              >
                <GitBranch className="h-4 w-4" />
              </a>
              <a
                href="mailto:hello@secureentry.app"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600"
                aria-label="Email us"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-sm font-semibold text-slate-900">
                {section.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 transition-colors hover:text-blue-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} SecureEntry. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              Secure by design
            </span>
            <span className="inline-flex items-center gap-1.5">
              <QrCode className="h-4 w-4 text-blue-600" />
              QR-powered
            </span>
            <a
              href="https://github.com/mahirsiam2004/visitor-management-system"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-slate-500 transition-colors hover:text-blue-600"
            >
              Developed by Mahir Siam
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
