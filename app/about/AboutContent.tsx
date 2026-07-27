'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  QrCode,
  ShieldCheck,
  BarChart3,
  ArrowRight,
  Target,
  Eye,
  HeartHandshake,
  UserCheck,
  Bell,
  CheckCircle2,
  Database,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import SiteNavbar from '@/components/marketing/SiteNavbar'
import SiteFooter from '@/components/marketing/SiteFooter'
import { fadeInUp, staggerContainer, viewportOnce } from '@/components/marketing/animations'

const values = [
  {
    icon: Target,
    title: 'Purpose-built',
    description:
      'Designed specifically for residential communities — not a generic office check-in tool.',
  },
  {
    icon: ShieldCheck,
    title: 'Security-first',
    description:
      'Auth, data access, and QR tokens are engineered around least-privilege and privacy.',
  },
  {
    icon: HeartHandshake,
    title: 'Effortless for everyone',
    description:
      'Residents, guards, and admins each get a focused experience that just works.',
  },
]

const workflow = [
  {
    icon: UserCheck,
    role: 'Resident',
    title: '1. Resident issues a guest pass',
    description:
      'A resident signs in and creates a guest pass for their visitor — choosing a validity window of 1 to 24 hours and adding optional visit details. The system generates a unique, opaque QR token and the resident shares it by link or download.',
    points: [
      'Set pass validity (1–24 hours)',
      'Share pass via link or download the QR',
      'Revoke or extend a pass any time',
    ],
  },
  {
    icon: ShieldCheck,
    role: 'Security Guard',
    title: '2. Guard verifies at the entrance',
    description:
      'At the gate, the security guard scans the visitor’s QR code using the guard dashboard. SecureEntry instantly resolves the pass, shows the visitor and resident details, and lets the guard check the guest in with a single tap.',
    points: [
      'Camera-based QR scanning',
      'Instant pass validation & details',
      'One-tap check-in / check-out',
    ],
  },
  {
    icon: Bell,
    role: 'Resident + Guard',
    title: '3. Everyone stays informed',
    description:
      'The moment a guest is verified or checked in, the resident receives a notification. The entry is written to a permanent, auditable log that both the guard and admin can review.',
    points: [
      'Real-time resident notifications',
      'Permanent entry log',
      'Live “today’s visitors” view',
    ],
  },
  {
    icon: BarChart3,
    role: 'Admin',
    title: '4. Admin monitors & reports',
    description:
      'Administrators get a full control center: manage residents and security guards, review all guest passes and entry logs with date filters, view analytics, and export data to CSV for compliance and reporting.',
    points: [
      'Manage residents, guards & roles',
      'Filterable entry logs & analytics',
      'CSV export for records',
    ],
  },
]

const tech = [
  { icon: Database, label: 'Supabase PostgreSQL' },
  { icon: Lock, label: 'Row Level Security' },
  { icon: QrCode, label: 'QR pass generation' },
  { icon: BarChart3, label: 'Realtime dashboards' },
]

export default function AboutContent() {
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
              About SecureEntry
            </motion.span>
            <motion.h1
              variants={fadeInUp}
              className="mx-auto mt-3 max-w-3xl text-4xl font-bold leading-tight text-slate-900 lg:text-5xl"
            >
              Modern visitor management built for{' '}
              <span className="text-blue-600">residential communities</span>
            </motion.h1>
            <motion.p
              variants={fadeInUp}
              className="mx-auto mt-6 max-w-2xl text-lg text-slate-600"
            >
              We replace paper logbooks and ad-hoc entry calls with a single,
              secure system that connects residents, security, and
              administrators — so every visit is trackable, verifiable, and
              safe.
            </motion.p>
            <motion.div variants={fadeInUp} className="mt-10">
              <Link href="/auth/sign-up">
                <Button size="xl" className="gap-2">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* Mission / Values */}
        <section className="mx-auto max-w-6xl px-6 py-12">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="grid gap-6 md:grid-cols-3"
          >
            {values.map((value) => (
              <motion.div
                key={value.title}
                variants={fadeInUp}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                  <value.icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="mb-2 font-semibold text-slate-900">
                  {value.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* How the system works */}
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
              How the system works
            </motion.span>
            <motion.h2
              variants={fadeInUp}
              className="mt-2 text-3xl font-bold text-slate-900 lg:text-4xl"
            >
              A clear workflow anyone can follow
            </motion.h2>
            <motion.p variants={fadeInUp} className="mt-4 text-slate-600">
              See exactly how a visitor moves through SecureEntry — from
              invitation to entry to reporting.
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="space-y-6"
          >
            {workflow.map((step) => (
              <motion.div
                key={step.title}
                variants={fadeInUp}
                className="grid items-start gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:grid-cols-[auto_1fr]"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                    <step.icon className="h-7 w-7 text-blue-600" />
                  </div>
                  <span className="rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-700">
                    {step.role}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-slate-600">
                    {step.description}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {step.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Tech stack */}
        <section className="mx-auto max-w-6xl px-6 py-12">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="rounded-3xl border border-blue-100 bg-blue-50/60 p-10"
          >
            <h2 className="text-center text-2xl font-bold text-slate-900">
              Built on a modern, secure stack
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {tech.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-white bg-white p-6 text-center shadow-sm"
                >
                  <item.icon className="h-6 w-6 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"
          >
            <h2 className="text-2xl font-bold text-slate-900 lg:text-3xl">
              Ready to modernize visitor access?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">
              Create an account or reach out — we’ll help you get set up.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/auth/sign-up">
                <Button size="xl" className="gap-2">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/services">
                <Button size="xl" variant="outline">
                  Explore services
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
