import { z } from 'zod';

// ─── Auth Schemas ────────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phone: z
      .string()
      .min(10, 'Phone must be at least 10 digits')
      .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number'),
    apartment: z.string().min(1, 'Apartment/Unit number is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Guest Pass Schema ───────────────────────────────────────────────────────

export const guestPassSchema = z.object({
  guestName: z.string().min(2, 'Guest name must be at least 2 characters'),
  guestPhone: z
    .string()
    .min(10, 'Phone must be at least 10 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number'),
  visitDate: z.string().min(1, 'Visit date is required'),
  visitTime: z.string().min(1, 'Visit time is required'),
  duration: z.coerce.number().min(1).max(24),
  purpose: z.string().min(3, 'Purpose must be at least 3 characters'),
});

// ─── Security Scanner Schema ─────────────────────────────────────────────────

export const tokenSearchSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// ─── Profile Update Schema ───────────────────────────────────────────────────

export const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .min(10, 'Phone must be at least 10 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number'),
  apartment: z.string().optional(),
});

// ─── Exported Types ──────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GuestPassInput = z.infer<typeof guestPassSchema>;
export type TokenSearchInput = z.infer<typeof tokenSearchSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
