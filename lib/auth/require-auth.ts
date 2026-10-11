/**
 * Shared auth helpers used by all Server Actions.
 * - Never throws "Profile not found" — returns a typed error instead.
 * - Handles NULL is_active gracefully (old accounts before migration 004).
 * - Single source of truth for role checks.
 */
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string; email?: string }
  profile: {
    role: UserRole
    is_active: boolean
    full_name: string
    apartment_number: string | null
    phone_number: string | null
    building_id: string | null
    delivery_auto_allow_until: string | null
  }
}

type AuthResult =
  | { ok: true;  ctx: AuthContext }
  | { ok: false; error: string }

export async function getAuthContext(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return { ok: false, error: 'Not authenticated' }
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()   // never throws PGRST116

  if (profErr) {
    return { ok: false, error: `Profile query failed: ${profErr.message}` }
  }

  if (!profile) {
    // Profile row missing — this happens for brand-new signups before the
    // handle_new_user trigger has committed. Return a safe error.
    return { ok: false, error: 'Profile not set up yet. Please refresh the page.' }
  }

  // is_active can be NULL in old rows (pre-migration-004) — treat NULL as TRUE
  const isActive = profile.is_active !== false

  if (!isActive) {
    return { ok: false, error: 'Your account has been deactivated. Contact admin.' }
  }

  return {
    ok: true,
    ctx: {
      supabase,
      user: { id: user.id, email: user.email },
      profile: {
        role:                     profile.role as UserRole,
        is_active:                isActive,
        full_name:                profile.full_name ?? '',
        apartment_number:         profile.apartment_number ?? null,
        phone_number:             profile.phone_number ?? null,
        building_id:              profile.building_id ?? null,
        delivery_auto_allow_until: profile.delivery_auto_allow_until ?? null,
      },
    },
  }
}

/** Throws ActionResult-style error string on failure. Use inside try/catch. */
export async function requireAuth(): Promise<AuthContext> {
  const result = await getAuthContext()
  if (!result.ok) throw new Error(result.error)
  return result.ctx
}

export async function requireRole(...roles: UserRole[]): Promise<AuthContext> {
  const ctx = await requireAuth()
  if (!roles.includes(ctx.profile.role)) {
    throw new Error(`Access denied. Required role: ${roles.join(' or ')}`)
  }
  return ctx
}
