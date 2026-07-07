'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowRight, ArrowLeft, Mail } from 'lucide-react'
import { forgotPassword } from '@/app/actions/auth'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validations/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordInput) => {
    setLoading(true)
    try {
      const result = await forgotPassword(data)
      if (result.success) {
        setSent(true)
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl overflow-hidden mb-4 shadow-lg">
            <img src="/logo.png" alt="SecureEntry" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {sent ? 'Check your email' : 'Reset your password'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {sent
              ? `We sent a password reset link to ${getValues('email')}`
              : 'Enter your email and we will send you a reset link'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {sent ? (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                  <Mail className="h-7 w-7 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-slate-600">
                If an account exists for that email, you will receive a password reset link shortly. Please check your spam folder if you do not see it.
              </p>
              <Button
                onClick={() => setSent(false)}
                variant="outline"
                className="w-full"
              >
                Send another email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    disabled={loading}
                    aria-invalid={!!errors.email}
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-600" role="alert">{errors.email.message}</p>
                  )}
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? 'Sending...' : (
                    <>
                      Send reset link
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-5 text-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
