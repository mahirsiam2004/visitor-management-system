'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { signUpSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema, changePasswordSchema } from '@/lib/validations/schemas'
import type { ActionResult, Profile } from '@/types'
import { ROUTES } from '@/constants'

export async function signUp(input: unknown): Promise<ActionResult<{ requiresEmailConfirmation: boolean }>> {
  try {
    const validated = signUpSchema.parse(input)
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}${ROUTES.AUTH_CALLBACK}`,
        data: {
          full_name: validated.fullName,
          apartment_number: validated.apartmentNumber,
          phone_number: validated.phoneNumber,
          role: 'resident',
        },
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        return { success: false, error: 'An account with this email already exists.' }
      }
      return { success: false, error: error.message }
    }

    if (!data.user) {
      return { success: false, error: 'Failed to create account. Please try again.' }
    }

    // Upsert profile in case trigger hasn't run
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email: validated.email,
      full_name: validated.fullName,
      apartment_number: validated.apartmentNumber,
      phone_number: validated.phoneNumber,
      role: 'resident',
    })

    if (profileError && !profileError.message.includes('duplicate')) {
      console.error('Profile creation error:', profileError)
    }

    const requiresEmailConfirmation = !data.session

    return {
      success: true,
      data: { requiresEmailConfirmation },
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function login(input: unknown): Promise<ActionResult<{ role: string }>> {
  try {
    const validated = loginSchema.parse(input)
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    })

    if (error) {
      if (
        error.message.includes('Invalid login credentials') ||
        error.message.includes('invalid_credentials')
      ) {
        return { success: false, error: 'Invalid email or password.' }
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, error: 'Please confirm your email address before logging in.' }
      }
      return { success: false, error: error.message }
    }

    if (!data.user) {
      return { success: false, error: 'Login failed. Please try again.' }
    }

    // Try to get the profile role; fall back to 'resident' gracefully
    let role = 'resident'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()
      if (profile?.role) role = profile.role
    } catch {
      // profiles table may not exist yet — default to resident
    }

    return {
      success: true,
      data: { role },
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function logout(): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: undefined }
}

export async function forgotPassword(input: unknown): Promise<ActionResult> {
  try {
    const validated = forgotPasswordSchema.parse(input)
    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(validated.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}${ROUTES.RESET_PASSWORD}`,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function resetPassword(input: unknown): Promise<ActionResult> {
  try {
    const validated = resetPasswordSchema.parse(input)
    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({
      password: validated.password,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function getProfile(): Promise<ActionResult<Profile>> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) return { success: false, error: error.message }

    return { success: true, data }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateProfile(input: unknown): Promise<ActionResult<Profile>> {
  try {
    const validated = updateProfileSchema.parse(input)
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const updateData: Record<string, unknown> = {}
    if (validated.fullName !== undefined) updateData.full_name = validated.fullName
    if (validated.phoneNumber !== undefined) updateData.phone_number = validated.phoneNumber
    if (validated.apartmentNumber !== undefined) updateData.apartment_number = validated.apartmentNumber

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/resident/profile')
    return { success: true, data }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function changePassword(input: unknown): Promise<ActionResult> {
  try {
    const validated = changePasswordSchema.parse(input)
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Re-authenticate with current password first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: validated.currentPassword,
    })

    if (signInError) {
      return { success: false, error: 'Current password is incorrect.' }
    }

    const { error } = await supabase.auth.updateUser({
      password: validated.newPassword,
    })

    if (error) return { success: false, error: error.message }

    return { success: true, data: undefined }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}
