import { z } from 'zod'
import { normalizeBdPhone } from '@/lib/utils/guest-pass'

// ── Bangladesh phone: 01[3-9]XXXXXXXX or +8801[3-9]XXXXXXXX ──────────────
const BD_PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/

function validateAndNormalizeBdPhone(val: string): string {
  const stripped = val.replace(/[\s\-().]/g, '')
  if (!BD_PHONE_RE.test(stripped)) {
    throw new Error('Enter a valid BD number: 01XXXXXXXXX or +8801XXXXXXXXX')
  }
  return normalizeBdPhone(stripped)
}

const bdPhoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .transform((val, ctx) => {
    try {
      return validateAndNormalizeBdPhone(val)
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: (e as Error).message,
      })
      return z.NEVER
    }
  })

const bdPhoneOptionalSchema = z
  .string()
  .optional()
  .transform((val, ctx) => {
    if (!val || val.trim() === '') return undefined
    try {
      return validateAndNormalizeBdPhone(val.trim())
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: (e as Error).message,
      })
      return z.NEVER
    }
  })

// ── Apartment: letter(s) + hyphen + digits, e.g. A-101, B2-305 ────────────
const APARTMENT_RE = /^[A-Za-z]\d*-\d{1,4}[A-Za-z]?$/

const apartmentSchema = z
  .string()
  .min(1, 'Apartment number is required')
  .max(20, 'Apartment number too long')
  .refine(
    (v) => APARTMENT_RE.test(v.trim()),
    'Use format A-101 (letter, hyphen, number)'
  )
  .transform((v) => v.trim().toUpperCase())

// ────────────────────────────────────────────────────────────────────────────

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name must be less than 100 characters'),
    email: z.string().email('Please enter a valid email address'),
    phoneNumber: bdPhoneSchema,
    apartmentNumber: apartmentSchema,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const createGuestPassSchema = z.object({
  guestName: z
    .string()
    .min(2, 'Guest name must be at least 2 characters')
    .max(100, 'Guest name too long'),
  guestPhone: bdPhoneOptionalSchema,
  visitDate: z.string().refine((date) => {
    const selected = new Date(date + 'T00:00:00+06:00') // Dhaka local
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return selected >= today
  }, 'Visit date must be today or in the future'),
  visitTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  durationHours: z.number().min(1).max(24, 'Duration must be between 1 and 24 hours'),
  purpose: z
    .string()
    .min(3, 'Purpose must be at least 3 characters')
    .max(200, 'Purpose too long'),
})

export const updateGuestPassSchema = createGuestPassSchema.partial()

export const checkInGuestSchema = z.object({
  token: z.string().uuid('Invalid QR token'),
})

export const checkOutGuestSchema = z.object({
  entryLogId: z.string().uuid('Invalid entry log ID'),
})

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name too long')
    .optional(),
  phoneNumber: z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (!val || val.trim() === '') return undefined
      try {
        return validateAndNormalizeBdPhone(val.trim())
      } catch (e) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message })
        return z.NEVER
      }
    }),
  apartmentNumber: apartmentSchema.optional(),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })

export const manualTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type CreateGuestPassInput = z.infer<typeof createGuestPassSchema>
export type UpdateGuestPassInput = z.infer<typeof updateGuestPassSchema>
export type CheckInGuestInput = z.infer<typeof checkInGuestSchema>
export type CheckOutGuestInput = z.infer<typeof checkOutGuestSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ManualTokenInput = z.infer<typeof manualTokenSchema>
