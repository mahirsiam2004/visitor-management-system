import Link from 'next/link';
import { Shield, ArrowRight, CheckCircle, QrCode, Users, Lock } from 'lucide-react';

export default function LandingPage() {
  const features = [
    {
      icon: QrCode,
      title: 'QR-Based Access',
      desc: 'Generate unique QR codes for each guest. Instant scanning by security.',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      icon: Shield,
      title: 'Role-Based Security',
      desc: 'Separate portals for Residents, Security Guards and Administrators.',
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
    },
    {
      icon: Users,
      title: 'Real-Time Tracking',
      desc: 'Live status of every visitor: Active, Inside, Expired or Completed.',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      icon: Lock,
      title: 'Time-Locked Passes',
      desc: 'Passes automatically expire. No entry allowed after the time window.',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/20',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="border-b border-gray-800/60 glass-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-green-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight gradient-text">Secure VMS</span>
          </div>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-900/30"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-green-600/8 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6 py-28 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
            <CheckCircle className="w-4 h-4" />
            Production-Ready Visitor Management
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
            Smart Access
            <br />
            <span className="gradient-text">For Smart Buildings</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Issue QR-based guest passes, track arrivals in real-time, and manage
            your building's security from one modern dashboard.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-lg shadow-xl shadow-blue-900/30 hover:shadow-blue-900/50 hover:from-blue-500 hover:to-blue-400 transition-all"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-gray-700 text-gray-300 font-semibold text-lg hover:border-gray-500 hover:text-white hover:bg-gray-800/50 transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need to{' '}
            <span className="gradient-text">manage visitors</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            From QR generation to real-time check-in, built for modern residential security.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className={`p-6 rounded-2xl border ${f.bg} hover:-translate-y-1 transition-all duration-300`}
            >
              <div className={`w-11 h-11 rounded-xl bg-gray-900/50 flex items-center justify-center mb-4 ${f.color}`}>
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────── */}
      <section className="border-y border-gray-800/60 glass-card">
        <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'QR Passes Issued', value: '10K+' },
            { label: 'Buildings Secured', value: '500+' },
            { label: 'Check-ins Logged', value: '50K+' },
            { label: 'Uptime', value: '99.9%' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-4xl font-extrabold gradient-text mb-1">{stat.value}</div>
              <div className="text-gray-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-gray-800/60 py-8 text-center text-gray-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-gray-400">Secure VMS</span>
        </div>
        <p>&copy; {new Date().getFullYear()} Secure Visitor Management System. All rights reserved.</p>
      </footer>
    </div>
  );
}
