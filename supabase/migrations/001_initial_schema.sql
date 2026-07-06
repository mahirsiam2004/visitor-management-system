-- ============================================================
-- Secure Visitor Management System - Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  apartment_number TEXT,
  role TEXT NOT NULL DEFAULT 'resident' CHECK (role IN ('resident', 'security', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GUEST PASSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guest_passes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_id TEXT NOT NULL UNIQUE,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  resident_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  apartment_number TEXT NOT NULL,
  visit_date DATE NOT NULL,
  visit_time TIME NOT NULL,
  expiry_time TIMESTAMPTZ NOT NULL,
  duration_hours INTEGER NOT NULL CHECK (duration_hours BETWEEN 1 AND 24),
  purpose TEXT NOT NULL,
  qr_token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ENTRY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entry_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_pass_id UUID NOT NULL REFERENCES public.guest_passes(id) ON DELETE CASCADE,
  security_guard_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'inside' CHECK (status IN ('inside', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_guest_passes_resident_id ON public.guest_passes(resident_id);
CREATE INDEX IF NOT EXISTS idx_guest_passes_qr_token ON public.guest_passes(qr_token);
CREATE INDEX IF NOT EXISTS idx_guest_passes_status ON public.guest_passes(status);
CREATE INDEX IF NOT EXISTS idx_guest_passes_visit_date ON public.guest_passes(visit_date);
CREATE INDEX IF NOT EXISTS idx_guest_passes_expiry_time ON public.guest_passes(expiry_time);
CREATE INDEX IF NOT EXISTS idx_entry_logs_guest_pass_id ON public.entry_logs(guest_pass_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_security_guard_id ON public.entry_logs(security_guard_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_status ON public.entry_logs(status);
CREATE INDEX IF NOT EXISTS idx_entry_logs_entry_time ON public.entry_logs(entry_time);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER guest_passes_updated_at
  BEFORE UPDATE ON public.guest_passes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER entry_logs_updated_at
  BEFORE UPDATE ON public.entry_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- NEW USER HANDLER - Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone_number, apartment_number, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone_number',
    NEW.raw_user_meta_data->>'apartment_number',
    COALESCE(NEW.raw_user_meta_data->>'role', 'resident')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- AUTO-EXPIRE GUEST PASSES FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_guest_passes()
RETURNS void AS $$
BEGIN
  UPDATE public.guest_passes
  SET status = 'expired'
  WHERE status = 'valid'
    AND expiry_time < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Security guards can read profiles (to see resident info)
CREATE POLICY "profiles_select_security" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('security', 'admin')
    )
  );

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow insert for new users (handled by trigger)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admins can delete profiles
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- GUEST PASSES POLICIES
-- ============================================================

-- Residents can only see their own passes
CREATE POLICY "guest_passes_select_resident" ON public.guest_passes
  FOR SELECT USING (resident_id = auth.uid());

-- Security and admin can see all passes
CREATE POLICY "guest_passes_select_security_admin" ON public.guest_passes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('security', 'admin')
    )
  );

-- Residents can create passes
CREATE POLICY "guest_passes_insert_resident" ON public.guest_passes
  FOR INSERT WITH CHECK (
    resident_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'resident'
    )
  );

-- Residents can update their own passes (e.g., revoke)
CREATE POLICY "guest_passes_update_resident" ON public.guest_passes
  FOR UPDATE USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid());

-- Admins can update any pass
CREATE POLICY "guest_passes_update_admin" ON public.guest_passes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete passes
CREATE POLICY "guest_passes_delete_admin" ON public.guest_passes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- ENTRY LOGS POLICIES
-- ============================================================

-- Security and admins can view entry logs
CREATE POLICY "entry_logs_select_security_admin" ON public.entry_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('security', 'admin')
    )
  );

-- Residents can see entry logs for their own passes
CREATE POLICY "entry_logs_select_resident" ON public.entry_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.guest_passes
      WHERE id = entry_logs.guest_pass_id AND resident_id = auth.uid()
    )
  );

-- Security and admin can insert entry logs
CREATE POLICY "entry_logs_insert_security_admin" ON public.entry_logs
  FOR INSERT WITH CHECK (
    security_guard_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('security', 'admin')
    )
  );

-- Security and admin can update entry logs
CREATE POLICY "entry_logs_update_security_admin" ON public.entry_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('security', 'admin')
    )
  );

-- ============================================================
-- VERIFY TOKEN FUNCTION (public access for QR verification)
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_guest_token(p_token UUID)
RETURNS JSON AS $$
DECLARE
  v_pass public.guest_passes%ROWTYPE;
  v_resident public.profiles%ROWTYPE;
  v_entry_log public.entry_logs%ROWTYPE;
  v_result JSON;
BEGIN
  -- First expire any stale passes
  PERFORM public.expire_guest_passes();

  -- Get the guest pass
  SELECT * INTO v_pass
  FROM public.guest_passes
  WHERE qr_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'status', 'not_found', 'message', 'Guest pass not found');
  END IF;

  -- Get resident info
  SELECT * INTO v_resident
  FROM public.profiles
  WHERE id = v_pass.resident_id;

  -- Check status
  IF v_pass.status = 'revoked' THEN
    RETURN json_build_object('valid', false, 'status', 'revoked', 'message', 'This guest pass has been revoked');
  END IF;

  IF v_pass.status = 'expired' OR v_pass.expiry_time < NOW() THEN
    RETURN json_build_object('valid', false, 'status', 'expired', 'message', 'This guest pass has expired');
  END IF;

  -- Check for active entry log
  SELECT * INTO v_entry_log
  FROM public.entry_logs
  WHERE guest_pass_id = v_pass.id AND status = 'inside'
  ORDER BY entry_time DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'status', 'already_inside',
      'message', 'Guest is already inside',
      'entry_log_id', v_entry_log.id,
      'entry_time', v_entry_log.entry_time
    );
  END IF;

  -- Check for completed visit
  SELECT * INTO v_entry_log
  FROM public.entry_logs
  WHERE guest_pass_id = v_pass.id AND status = 'completed'
  ORDER BY entry_time DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'status', 'completed',
      'message', 'Guest has already completed their visit',
      'entry_time', v_entry_log.entry_time,
      'exit_time', v_entry_log.exit_time
    );
  END IF;

  -- Pass is valid
  RETURN json_build_object(
    'valid', true,
    'status', 'valid',
    'message', 'Guest pass is valid',
    'guest_pass', json_build_object(
      'id', v_pass.id,
      'guest_id', v_pass.guest_id,
      'guest_name', v_pass.guest_name,
      'guest_phone', v_pass.guest_phone,
      'apartment_number', v_pass.apartment_number,
      'visit_date', v_pass.visit_date,
      'visit_time', v_pass.visit_time,
      'expiry_time', v_pass.expiry_time,
      'duration_hours', v_pass.duration_hours,
      'purpose', v_pass.purpose,
      'qr_token', v_pass.qr_token
    ),
    'resident', json_build_object(
      'id', v_resident.id,
      'full_name', v_resident.full_name,
      'apartment_number', v_resident.apartment_number
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
