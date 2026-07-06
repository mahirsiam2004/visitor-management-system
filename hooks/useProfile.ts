'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile, UserRole } from '@/types'
import { ROLE_ROUTES } from '@/constants'

interface UseProfileOptions {
  requiredRole?: UserRole | UserRole[]
  redirectOnFail?: boolean
}

export function useProfile(options: UseProfileOptions = {}) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        if (options.redirectOnFail !== false) {
          router.push('/auth/login')
        }
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        setError(profileError.message)
        return
      }

      setProfile(data)

      // Check role
      if (options.requiredRole) {
        const allowedRoles = Array.isArray(options.requiredRole)
          ? options.requiredRole
          : [options.requiredRole]

        if (!allowedRoles.includes(data.role)) {
          router.push(ROLE_ROUTES[data.role] || '/auth/login')
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return { profile, loading, error, refetch: fetchProfile }
}
