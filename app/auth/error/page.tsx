'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
          <div className="flex justify-center mb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">Authentication Error</h1>
          <p className="text-slate-500 text-sm mb-6">
            Something went wrong during authentication. This link may have expired or already been used.
          </p>

          <div className="space-y-3">
            <Link href="/auth/login">
              <Button className="w-full">Try Signing In</Button>
            </Link>
            <Link href="/auth/forgot-password">
              <Button variant="outline" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" />
                Request New Link
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
