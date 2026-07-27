'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  QrCode,
  ShieldCheck,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  UserCheck,
  Bell,
  Lock,
  Clock,
  Building2,
  Smartphone,
  KeyRound,
  Quote,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import SiteNavbar from '@/components/marketing/SiteNavbar'
import SiteFooter from '@/components/marketing/SiteFooter'
import { fadeInUp, staggerContainer, viewportOnce } from '@/components/marketing/animations'

const features = [
  {
    icon: QrCode,
    title: 'QR Guest Passes',
    description:
      'Residents create secure, time-bound QR passes for visitors with configurable duration and access details — shareable via link or download.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Entry Control',
    description:
      'Security guards scan QR codes for instant verification and manage check-in / check-out from a single, real-time dashboard.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description:
      'Admins gain full visibility into visitor activity, daily trends, and security reports with exportable CSV data.',
  },
  {
    icon: UserCheck,
    title: 'Role-based Access',
    description:
      'Three tailored dashboards — Resident, Security, and Admin — each scoped by Supabase Row Level Security policies.',
  },
  {
    icon: Bell,
    title: 'Live Notifications',
    description:
      'Residents are notified the moment their guest is verified or checked in, keeping everyone in the loop.',
  },
  {
    icon: Lock,
    title: 'Privacy First',
    description:
      'QR tokens are opaque UUIDs — no personal data is ever encoded in the code. All data stays protected behind auth.',
  },
]

const steps = [
  {
    icon: QrCode,
    role: 'Resident',
    title: 'Create a guest pass',
    description:
      'Generate a QR pass for your visitor in seconds — set a validity window (1–24 hours) and share it by link or download.',
  },
  {
    icon: ShieldCheck,
    role: 'Security Guard',
    title: 'Scan & verify at the gate',
    description:
      'The guard scans the visitor’s QR code, sees full pass details instantly, then checks the guest in with one tap.',
  },
  {
    icon: BarChart3,
    role: 'Admin',
    title: 'Monitor & analyze',
    description:
      'Track every entry and exit, review live logs, manage residents and guards, and export reports — all from the admin console.',
  },
]

const stats = [
  { value: '3', label: 'Role-based dashboards' },
  { value: '24/7', label: 'Real-time monitoring' },
  { value: '1–24h', label: 'Configurable pass validity' },
  { value: '100%', label: 'QR-secured, no personal data' },
]

const faqs = [
  {
    q: 'Do visitors need to install an app?',
    a: 'No. Visitors simply show the QR pass on their phone — generated and shared by the resident. Guards scan it with the security dashboard.',
  },
  {
    q: 'How long is a guest pass valid?',
    a: 'Residents can set each pass to expire automatically anywhere between 1 and 24 hours. Expired passes are rejected at the gate.',
  },
  {
    q: 'Is the visitor data secure?',
    a: 'Yes. Authentication and data are handled by Supabase with Row Level Security. QR codes contain only an opaque token — never personal information.',
  },
  {
    q: 'Can I export visitor logs?',
    a: 'Absolutely. Admins can export both guest passes and entry logs to CSV for record-keeping and reporting.',
  },
  {
    q: 'Who can use SecureEntry?',
    a: 'Residential complexes, gated communities, and apartment buildings that need a clean, auditable way to manage who comes and goes.',
  },
]

const testimonial = {
  quote:
    'SecureEntry replaced our paper logbook completely. Guards verify guests in seconds and the admin dashboard gives us a clear record of every visit.',
  name: 'Community Administrator',
  role: 'Residential Complex Operations',
}

export default function LandingPage() {
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
            <motion.div
              variants={fadeInUp}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Enterprise-Grade Visitor Management
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="mx-auto max-w-4xl text-4xl font-bold leading-tight text-slate-900 lg:text-6xl"
            >
              Secure access for your{' '}
              <span className="text-blue-600">residential community</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="mx-auto mt-6 max-w-2xl text-lg text-slate-600"
            >
              SecureEntry streamlines visitor management with QR-based guest
              passes, real-time security monitoring, and comprehensive
              administrative controls — so you always know who is coming and
              going.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="mt-10 flex flex-wrap items-center justify-center gap-4"
            >
              <Link href="/auth/sign-up">
                <Button size="xl" className="gap-2">
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/about">
                <Button size="xl" variant="outline">
                  See how it works
                </Button>
              </Link>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3"
            >
              {[
                { icon: Smartphone, text: 'No app needed for visitors' },
                { icon: KeyRound, text: 'Secure, expiring QR passes' },
                { icon: Building2, text: 'Built for residential communities' },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-600"
                >
                  <item.icon className="h-4 w-4 text-blue-600" />
                  {item.text}
                </div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-16">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="mx-auto mb-12 max-w-2xl text-center"
          >
            <motion.h2
              variants={fadeInUp}
              className="text-3xl font-bold text-slate-900 lg:text-4xl"
            >
              Everything you need to manage visitors
            </motion.h2>
            <motion.p variants={fadeInUp} className="mt-4 text-slate-600">
              Purpose-built features for residents, security teams, and
              administrators — working together in one secure system.
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                  <feature.icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="mb-2 font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="mx-auto max-w-6xl px-6 py-16"
        >
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
              How it works
            </motion.span>
            <motion.h2
              variants={fadeInUp}
              className="mt-2 text-3xl font-bold text-slate-900 lg:text-4xl"
            >
              From invitation to entry in three steps
            </motion.h2>
            <motion.p variants={fadeInUp} className="mt-4 text-slate-600">
              A simple, secure flow that connects residents, security, and
              administration.
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="grid gap-6 md:grid-cols-3"
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.role}
                variants={fadeInUp}
                className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  Step {i + 1}
                </span>
                <div className="mb-4 mt-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                  <step.icon className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {step.role}
                </p>
                <h3 className="mb-2 font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Stats */}
        <section className="mx-auto max-w-6xl px-6 py-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="grid gap-6 rounded-3xl border border-blue-100 bg-blue-50/60 p-8 sm:grid-cols-2 lg:grid-cols-4"
          >
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeInUp}
                className="text-center"
              >
                <p className="text-4xl font-bold text-blue-600">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm text-slate-600">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Testimonial */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"
          >
            <Quote className="mx-auto h-8 w-8 text-blue-600" />
            <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-slate-700">
              “{testimonial.quote}”
            </p>
            <div className="mt-6 flex items-center justify-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="mt-4 font-semibold text-slate-900">
              {testimonial.name}
            </p>
            <p className="text-sm text-slate-500">{testimonial.role}</p>
          </motion.div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="mx-auto max-w-3xl px-6 py-16"
        >
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="mb-10 text-center"
          >
            <h2 className="text-3xl font-bold text-slate-900 lg:text-4xl">
              Frequently asked questions
            </h2>
            <p className="mt-4 text-slate-600">
              Everything you might want to know before getting started.
            </p>
          </motion.div>

          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {faqs.map((faq) => (
              <details key={faq.q} className="group p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900">
                  {faq.q}
                  <span className="text-blue-600 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
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
                Bring secure, modern visitor management to your community
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-blue-100">
                Set up guest passes, guard verification, and admin analytics in
                minutes.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link href="/auth/sign-up">
                  <Button
                    size="xl"
                    variant="secondary"
                    className="gap-2 bg-white text-blue-700 hover:bg-blue-50"
                  >
                    Get Started Free
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
