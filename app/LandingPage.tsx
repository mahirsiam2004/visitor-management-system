'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Lock, QrCode, Shield, BarChart3, ArrowRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const features = [
  {
    icon: QrCode,
    title: 'QR Guest Passes',
    description: 'Residents create secure QR-based passes for visitors with configurable duration and access details.',
  },
  {
    icon: Shield,
    title: 'Secure Entry Control',
    description: 'Security guards scan QR codes for instant verification and manage check-in and check-out.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'Admins gain full visibility into all visitor activity, trends, and security reports.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Lock className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-slate-900">SecureEntry</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/auth/sign-up">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-16 lg:py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 mb-6">
            <CheckCircle className="h-3.5 w-3.5" />
            Enterprise-Grade Visitor Management
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
            Secure access for your{' '}
            <span className="text-blue-600">residential community</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10">
            SecureEntry streamlines visitor management with QR-based guest passes, real-time security monitoring, and comprehensive administrative controls.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/auth/sign-up">
              <Button size="xl" className="gap-2">
                Create Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="xl" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 mb-4">
                <feature.icon className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-500">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
