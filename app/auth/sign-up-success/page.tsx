'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle, Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
          <div className="flex justify-center mb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">Account Created!</h1>
          <p className="text-slate-500 text-sm mb-6">
            Your account has been created successfully. Please check your email inbox and click the confirmation link to activate your account.
          </p>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-blue-700 mb-1">
              <Mail className="h-4 w-4" />
              <span className="text-sm font-medium">Check your inbox</span>
            </div>
            <p className="text-xs text-blue-600">
              Confirmation email sent. Also check your spam folder.
            </p>
          </div>

          <Link href="/auth/login" className="block">
            <Button className="w-full gap-2" variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
