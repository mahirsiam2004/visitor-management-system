'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { signUp } from '@/app/actions/auth'
import { signUpSchema, type SignUpInput } from '@/lib/validations/schemas'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Logo from '@/components/ui/Logo'

const passwordRequirements = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
]

export default function SignUpPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [passwordValue, setPasswordValue] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
  })

  const onSubmit = async (data: SignUpInput) => {
    setLoading(true)
    try {
      const result = await signUp(data)
      if (result.success) {
        if (result.data.requiresEmailConfirmation) {
          router.push('/auth/sign-up-success')
        } else {
          // Email confirmation disabled — log in directly
          const supabase = createClient()
          await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          })
          toast.success('Account created successfully!')
          window.location.replace('/dashboard/resident')
        }
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const pwd = watch('password') || ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center p-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <Logo size="xl" />
          <p className="text-sm text-slate-500">Create your resident account</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
                  Full Name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="John Smith"
                  disabled={loading}
                  aria-invalid={!!errors.fullName}
                  {...register('fullName')}
                />
                {errors.fullName && (
                  <p className="text-xs text-red-600" role="alert">{errors.fullName.message}</p>
                )}
              </div>

              {/* Email */}
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

              {/* Phone & Apartment */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-slate-700">
                    Phone Number
                  </label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    autoComplete="tel"
                    placeholder="01XXXXXXXXX"
                    disabled={loading}
                    aria-invalid={!!errors.phoneNumber}
                    {...register('phoneNumber')}
                  />
                  {errors.phoneNumber && (
                    <p className="text-xs text-red-600" role="alert">{errors.phoneNumber.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="apartmentNumber" className="block text-sm font-medium text-slate-700">
                    Apartment No.
                  </label>
                  <Input
                    id="apartmentNumber"
                    type="text"
                    placeholder="A-101"
                    disabled={loading}
                    aria-invalid={!!errors.apartmentNumber}
                    {...register('apartmentNumber')}
                  />
                  {errors.apartmentNumber && (
                    <p className="text-xs text-red-600" role="alert">{errors.apartmentNumber.message}</p>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    disabled={loading}
                    aria-invalid={!!errors.password}
                    className="pr-10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password requirements */}
                {pwd.length > 0 && (
                  <div className="grid grid-cols-2 gap-1 pt-1">
                    {passwordRequirements.map((req) => (
                      <div key={req.label} className="flex items-center gap-1.5">
                        <div className={`h-3.5 w-3.5 rounded-full flex items-center justify-center ${req.test(pwd) ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          {req.test(pwd) && <Check className="h-2 w-2 text-white" />}
                        </div>
                        <span className={`text-xs ${req.test(pwd) ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {errors.password && (
                  <p className="text-xs text-red-600" role="alert">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    disabled={loading}
                    aria-invalid={!!errors.confirmPassword}
                    className="pr-10"
                    {...register('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-600" role="alert">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Creating account...' : (
                  <>
                    Create Account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
