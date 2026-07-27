'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  QrCode,
  ShieldCheck,
  BarChart3,
  UserCheck,
  Bell,
  Database,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import SiteNavbar from '@/components/marketing/SiteNavbar'
import SiteFooter from '@/components/marketing/SiteFooter'
import { fadeInUp, staggerContainer, viewportOnce } from '@/components/marketing/animations'

const services = [
  {
    icon: QrCode,
    title: 'QR Guest Pass Generation',
    summary:
      'Residents create secure, time-bound visitor passes in seconds.',
    features: [
      'Configurable validity (1–24 hours)',
      'Shareable link or downloadable QR',
      'Revoke and reissue passes any time',
      'No personal data encoded in the code',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Guard Verification & Entry Control',
    summary:
      'Security teams verify and log every visitor at the gate.',
    features: [
      'Camera-based QR scanning',
      'Instant pass detail lookup',
      'One-tap check-in / check-out',
      'Live “today’s visitors” dashboard',
    ],
  },
  {
    icon: BarChart3,
    title: 'Admin Analytics & Reporting',
    summary:
      'Administrators get full oversight of visitor activity.',
    features: [
      'Real-time activity dashboards',
      'Date-filtered entry logs',
      'CSV export for passes & logs',
      'Visitor trends & security reports',
    ],
  },
  {
    icon: UserCheck,
    title: 'Role & Resident Management',
    summary:
      'Manage who has access and what they can do.',
    features: [
      'Resident, Security, and Admin roles',
      'Role-based access control (RBAC)',
      'Supabase Row Level Security',
      'Easy onboarding via sign-up',
    ],
  },
  {
    icon: Bell,
    title: 'Resident Notifications',
    summary:
      'Keep residents informed about their guests.',
    features: [
      'Alert when a guest is verified',
      'Notify on check-in / check-out',
      'No extra apps for visitors',
      'Peace of mind for households',
    ],
  },
  {
    icon: Database,
    title: 'Secure Data & Hosting',
    summary:
      'Your community data stays protected end to end.',
    features: [
      'Supabase PostgreSQL backend',
      'Auth-protected every request',
      'Auditable, permanent entry logs',
      'Privacy-first by design',
    ],
  },
]

const process = [
  { step: '01', title: 'Discover', description: 'We map your community’s entry points and current process.' },
  { step: '02', title: 'Configure', description: 'Set up roles, guards, and pass rules to match your policy.' },
  { step: '03', title: 'Launch', description: 'Go live with resident and guard onboarding in minutes.' },
  { step: '04', title: 'Monitor', description: 'Track activity and export reports whenever you need them.' },
]

export default function ServicesContent() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <SiteNavbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 py-16 text-center lg:py-24">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.span
              variants={fadeInUp}
              className="text-sm font-semibold uppercase tracking-wide text-blue-600"
            >
              Services
            </motion.span>
            <motion.h1
              variants={fadeInUp}
              className="mx-auto mt-3 max-w-3xl text-4xl font-bold leading-tight text-slate-900 lg:text-5xl"
            >
              Visitor management,{' '}
              <span className="text-blue-600">end to end</span>
            </motion.h1>
            <motion.p
              variants={fadeInUp}
              className="mx-auto mt-6 max-w-2xl text-lg text-slate-600"
            >
              From the moment a guest pass is created to the final entry report,
              SecureEntry handles every step securely and simply.
            </motion.p>
          </motion.div>
        </section>

        {/* Services grid */}
        <section className="mx-auto max-w-6xl px-6 py-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {services.map((service) => (
              <motion.div
                key={service.title}
                variants={fadeInUp}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                  <service.icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="mb-2 font-semibold text-slate-900">
                  {service.title}
                </h3>
                <p className="mb-4 text-sm text-slate-500">
                  {service.summary}
                </p>
                <ul className="mt-auto space-y-2">
                  {service.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-slate-600"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Process */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="mx-auto mb-12 max-w-2xl text-center"
          >
            <motion.span
              variants={fadeInUp}
              className="text-sm font-semibold uppercase tracking-wide text-blue-600"
            >
              How we deliver
            </motion.span>
            <motion.h2
              variants={fadeInUp}
              className="mt-2 text-3xl font-bold text-slate-900 lg:text-4xl"
            >
              A simple rollout process
            </motion.h2>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {process.map((item) => (
              <motion.div
                key={item.step}
                variants={fadeInUp}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-3xl font-bold text-blue-600/30">
                  {item.step}
                </p>
                <h3 className="mt-2 font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="relative overflow-hidden rounded-3xl bg-blue-600 px-8 py-16 text-center shadow-lg"
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/40 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-blue-500/40 blur-2xl" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold text-white lg:text-4xl">
                Bring SecureEntry to your community
              </h2>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link href="/auth/sign-up">
                  <Button
                    size="xl"
                    variant="secondary"
                    className="gap-2 bg-white text-blue-700 hover:bg-blue-50"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    size="xl"
                    variant="outline"
                    className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    Contact us
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
