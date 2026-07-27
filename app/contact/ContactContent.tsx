'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, MapPin, Send, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SiteNavbar from '@/components/marketing/SiteNavbar'
import SiteFooter from '@/components/marketing/SiteFooter'
import { fadeInUp, staggerContainer, viewportOnce } from '@/components/marketing/animations'

const contactInfo = [
  {
    icon: Mail,
    title: 'Email',
    value: 'hello@secureentry.app',
    href: 'mailto:hello@secureentry.app',
  },
  {
    icon: MapPin,
    title: 'Service area',
    value: 'Residential communities worldwide',
    href: null,
  },
]

export default function ContactContent() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  // Client-side only: no secrets, no backend. Simulates a send for the demo
  // and resets. Wire this to your email provider / API route when ready.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) return
    setStatus('sending')
    window.setTimeout(() => {
      setStatus('sent')
      setForm({ name: '', email: '', message: '' })
      window.setTimeout(() => setStatus('idle'), 3000)
    }, 900)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <SiteNavbar />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mb-12 text-center"
          >
            <motion.span
              variants={fadeInUp}
              className="text-sm font-semibold uppercase tracking-wide text-blue-600"
            >
              Contact
            </motion.span>
            <motion.h1
              variants={fadeInUp}
              className="mx-auto mt-3 max-w-3xl text-4xl font-bold leading-tight text-slate-900 lg:text-5xl"
            >
              Let’s secure your community
            </motion.h1>
            <motion.p
              variants={fadeInUp}
              className="mx-auto mt-6 max-w-2xl text-lg text-slate-600"
            >
              Questions about SecureEntry? Send us a message and we’ll get back
              to you shortly.
            </motion.p>
          </motion.div>

          <div className="grid gap-10 lg:grid-cols-2">
            {/* Form */}
            <motion.form
              variants={fadeInUp}
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Your name"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="you@example.com"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label
                    htmlFor="message"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, message: e.target.value }))
                    }
                    placeholder="How can we help?"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full gap-2"
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : status === 'sent' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Message sent!
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send message
                    </>
                  )}
                </Button>
              </div>
            </motion.form>

            {/* Info */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              className="space-y-5"
            >
              {contactInfo.map((info) => (
                <motion.div
                  key={info.title}
                  variants={fadeInUp}
                  className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                    <info.icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {info.title}
                    </h3>
                    {info.href ? (
                      <a
                        href={info.href}
                        className="text-sm text-slate-600 transition-colors hover:text-blue-600"
                      >
                        {info.value}
                      </a>
                    ) : (
                      <p className="text-sm text-slate-600">{info.value}</p>
                    )}
                  </div>
                </motion.div>
              ))}

              <motion.div
                variants={fadeInUp}
                className="rounded-2xl border border-blue-100 bg-blue-50/60 p-6"
              >
                <h3 className="font-semibold text-slate-900">
                  Looking to get started?
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Create a free account and invite your security team in
                  minutes.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
