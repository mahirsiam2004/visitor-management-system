-- Fix infinite recursion in profiles RLS policies
-- The admin/security policies were self-referencing profiles table causing a loop
-- Solution: use auth.jwt() to read the role claim instead of querying profiles

-- Drop all existing profiles policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_security" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

-- Drop all existing guest_passes policies
DROP POLICY IF EXISTS "guest_passes_select_resident" ON public.guest_passes;
DROP POLICY IF EXISTS "guest_passes_select_security_admin" ON public.guest_passes;
DROP POLICY IF EXISTS "guest_passes_insert_resident" ON public.guest_passes;
DROP POLICY IF EXISTS "guest_passes_update_resident" ON public.guest_passes;
DROP POLICY IF EXISTS "guest_passes_update_admin" ON public.guest_passes;
DROP POLICY IF EXISTS "guest_passes_delete_admin" ON public.guest_passes;

-- Drop all existing entry_logs policies
DROP POLICY IF EXISTS "entry_logs_select_security_admin" ON public.entry_logs;
DROP POLICY IF EXISTS "entry_logs_select_resident" ON public.entry_logs;
DROP POLICY IF EXISTS "entry_logs_insert_security_admin" ON public.entry_logs;
DROP POLICY IF EXISTS "entry_logs_update_security_admin" ON public.entry_logs;

-- ============================================================
-- Create a SECURITY DEFINER function to safely get current user role
-- This breaks the recursion by bypassing RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES POLICIES (no self-referencing)
-- ============================================================

-- Any authenticated user can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles (uses SECURITY DEFINER function, no recursion)
CREATE POLICY "profiles_select_elevated"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() IN ('admin', 'security'));

-- Any authenticated user can insert their own profile
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- Admins can delete profiles
CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- GUEST PASSES POLICIES
-- ============================================================

-- Residents see only their own passes
CREATE POLICY "guest_passes_select_resident"
  ON public.guest_passes FOR SELECT
  USING (resident_id = auth.uid());

-- Security and admin see all passes
CREATE POLICY "guest_passes_select_elevated"
  ON public.guest_passes FOR SELECT
  USING (public.get_my_role() IN ('security', 'admin'));

-- Residents can create passes for themselves
CREATE POLICY "guest_passes_insert_resident"
  ON public.guest_passes FOR INSERT
  WITH CHECK (
    resident_id = auth.uid()
    AND public.get_my_role() = 'resident'
  );

-- Residents can update (revoke) their own passes
CREATE POLICY "guest_passes_update_resident"
  ON public.guest_passes FOR UPDATE
  USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid());

-- Admins can update any pass
CREATE POLICY "guest_passes_update_admin"
  ON public.guest_passes FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- Admins can delete passes
CREATE POLICY "guest_passes_delete_admin"
  ON public.guest_passes FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- ENTRY LOGS POLICIES
-- ============================================================

-- Security and admin can view all logs
CREATE POLICY "entry_logs_select_elevated"
  ON public.entry_logs FOR SELECT
  USING (public.get_my_role() IN ('security', 'admin'));

-- Residents can see logs for their own guest passes
CREATE POLICY "entry_logs_select_resident"
  ON public.entry_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.guest_passes
      WHERE id = entry_logs.guest_pass_id
        AND resident_id = auth.uid()
    )
  );

-- Security and admin can check in guests
CREATE POLICY "entry_logs_insert_elevated"
  ON public.entry_logs FOR INSERT
  WITH CHECK (
    security_guard_id = auth.uid()
    AND public.get_my_role() IN ('security', 'admin')
  );

-- Security and admin can check out guests
CREATE POLICY "entry_logs_update_elevated"
  ON public.entry_logs FOR UPDATE
  USING (public.get_my_role() IN ('security', 'admin'));
