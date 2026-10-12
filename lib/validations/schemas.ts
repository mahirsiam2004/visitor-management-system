import { z } from 'zod'
import { normalizeBdPhone } from '@/lib/utils/guest-pass'

// ── Bangladesh phone ──────────────────────────────────────────────────────
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
    try { return validateAndNormalizeBdPhone(val) }
    catch (e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message })
      return z.NEVER
    }
  })

const bdPhoneOptionalSchema = z
  .string()
  .optional()
  .transform((val, ctx) => {
    if (!val || val.trim() === '') return undefined
    try { return validateAndNormalizeBdPhone(val.trim()) }
    catch (e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message })
      return z.NEVER
    }
  })

// ── Apartment format ──────────────────────────────────────────────────────
const APARTMENT_RE = /^[A-Za-z]\d*-\d{1,4}[A-Za-z]?$/

const apartmentSchema = z
  .string()
  .min(1, 'Apartment number is required')
  .max(20, 'Apartment number too long')
  .refine((v) => APARTMENT_RE.test(v.trim()), 'Use format A-101 (letter, hyphen, number)')
  .transform((v) => v.trim().toUpperCase())

// ── Companion schema ──────────────────────────────────────────────────────
export const companionSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  relation:  z.string().min(1, 'Relation is required').max(50),
  is_minor:  z.boolean().default(false),
})

// ── Auth ──────────────────────────────────────────────────────────────────
export const signUpSchema = z
  .object({
    fullName:        z.string().min(2).max(100),
    email:           z.string().email('Please enter a valid email address'),
    phoneNumber:     bdPhoneSchema,
    apartmentNumber: apartmentSchema,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const loginSchema = z.object({
  email:      z.string().email(),
  password:   z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

// ── Guest pass creation ────────────────────────────────────────────────────
export const createGuestPassSchema = z.object({
  guestName:      z.string().min(2, 'Guest name required').max(100),
  guestPhone:     bdPhoneOptionalSchema,
  visitDate: z.string().refine((date) => {
    const selected = new Date(date + 'T00:00:00+06:00')
    const today    = new Date()
    today.setHours(0, 0, 0, 0)
    return selected >= today
  }, 'Visit date must be today or in the future'),
  visitTime:      z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  durationHours:  z.number().min(1).max(24),
  purpose:        z.string().min(3).max(200),
  allowedPersons: z.number().int().min(1).max(10).default(1),
  companions:     z.array(companionSchema).max(9, 'Max 9 companions').default([]),
  guestPhotoUrl:  z.string().url().optional().or(z.literal('')),
})

export const updateGuestPassSchema = createGuestPassSchema.partial()

// ── Check-in (guard confirms identity + records persons admitted) ──────────
export const checkInGuestSchema = z.object({
  token:           z.string().min(1, 'Token is required'),  // UUID or 6-digit gate code
  idType: z.enum([
    'nid', 'driving_license', 'student_id', 'known_to_resident', 'none',
  ]),
  identityVerified: z.boolean().refine((v) => v === true, 'Identity must be verified'),
  personsAdmitted:  z.number().int().min(1).max(10).default(1),
  entryPhotoUrl:    z.string().url().optional().or(z.literal('')),
})

// ── Check-out ─────────────────────────────────────────────────────────────
export const checkOutGuestSchema = z.object({
  entryLogId: z.string().uuid('Invalid entry log ID'),
})

// ── Revoke pass (resident) ────────────────────────────────────────────────
export const revokePassSchema = z.object({
  passId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

// ── Profile ───────────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phoneNumber: z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (!val || val.trim() === '') return undefined
      try { return validateAndNormalizeBdPhone(val.trim()) }
      catch (e) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message })
        return z.NEVER
      }
    }),
  apartmentNumber: apartmentSchema.optional(),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword:     z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })

export const manualTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

// ── Inferred types ────────────────────────────────────────────────────────
export type SignUpInput          = z.infer<typeof signUpSchema>
export type LoginInput           = z.infer<typeof loginSchema>
export type ForgotPasswordInput  = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput   = z.infer<typeof resetPasswordSchema>
export type CreateGuestPassInput = z.input<typeof createGuestPassSchema>
export type UpdateGuestPassInput = z.infer<typeof updateGuestPassSchema>
export type CheckInGuestInput    = z.infer<typeof checkInGuestSchema>
export type CheckOutGuestInput   = z.infer<typeof checkOutGuestSchema>
export type RevokePassInput      = z.infer<typeof revokePassSchema>
export type UpdateProfileInput   = z.input<typeof updateProfileSchema>
export type ChangePasswordInput  = z.infer<typeof changePasswordSchema>
export type ManualTokenInput     = z.infer<typeof manualTokenSchema>
export type CompanionInput       = z.infer<typeof companionSchema>
