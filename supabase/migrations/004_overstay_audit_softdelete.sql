-- ============================================================
-- Migration 004: Overstay tracking, audit log, soft-delete,
--                role safety, pg_cron expiry job
-- Idempotent: all statements use IF NOT EXISTS / OR REPLACE
-- ============================================================

-- ============================================================
-- 1. ENTRY_LOGS — new columns for overstay & checkout provenance
-- ============================================================
ALTER TABLE public.entry_logs
  ADD COLUMN IF NOT EXISTS expected_exit_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overstay_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_type      TEXT
    CHECK (checkout_type IN ('manual','auto_closed','admin_closed'));

-- Backfill expected_exit_at for existing rows that have a guest pass
UPDATE public.entry_logs el
SET expected_exit_at = gp.expiry_time
FROM public.guest_passes gp
WHERE el.guest_pass_id = gp.id
  AND el.expected_exit_at IS NULL;

-- Extend entry_logs status to include 'overstay'
-- (TEXT CHECK constraints can't be altered in place; drop + recreate)
ALTER TABLE public.entry_logs DROP CONSTRAINT IF EXISTS entry_logs_status_check;
ALTER TABLE public.entry_logs
  ADD CONSTRAINT entry_logs_status_check
  CHECK (status IN ('inside','completed','overstay'));

-- ============================================================
-- 2. GUEST_PASSES — soft-delete columns
-- ============================================================
ALTER TABLE public.guest_passes
  ADD COLUMN IF NOT EXISTS archived_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

-- Extend status to include 'used' (single-use completed pass)
ALTER TABLE public.guest_passes DROP CONSTRAINT IF EXISTS guest_passes_status_check;
ALTER TABLE public.guest_passes
  ADD CONSTRAINT guest_passes_status_check
  CHECK (status IN ('valid','expired','revoked','used'));

-- ============================================================
-- 3. PROFILES — soft-delete / deactivation
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS deactivated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- ============================================================
-- 4. AUDIT_LOG table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role  TEXT        NOT NULL,
  action      TEXT        NOT NULL,          -- e.g. 'pass.created', 'user.deactivated'
  entity_type TEXT        NOT NULL,          -- 'guest_pass' | 'entry_log' | 'profile' | 'system'
  entity_id   TEXT,                          -- UUID or other identifier
  metadata    JSONB       NOT NULL DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id    ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action      ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON public.audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON public.audit_log(created_at);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit_log
CREATE POLICY IF NOT EXISTS "audit_log_select_admin"
  ON public.audit_log FOR SELECT
  USING (public.get_my_role() = 'admin');

-- Server actions insert using service role (bypasses RLS), or authenticated role
CREATE POLICY IF NOT EXISTS "audit_log_insert_authenticated"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 5. TRIGGER: block UPDATE and DELETE on audit_log forever
-- ============================================================
CREATE OR REPLACE FUNCTION public.block_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log rows are immutable: UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON public.audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutation();

-- ============================================================
-- 6. Updated expire_guest_passes — now also marks 'used'
--    A pass is 'used' when it has a completed entry_log and
--    expiry_time is past (single-use semantics).
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_guest_passes()
RETURNS void AS $$
BEGIN
  -- Expire passes whose time has passed
  UPDATE public.guest_passes
  SET status = 'expired'
  WHERE status = 'valid'
    AND expiry_time < NOW()
    AND archived_at IS NULL;

  -- Mark passes as 'used' when a completed entry exists and pass is past expiry
  UPDATE public.guest_passes gp
  SET status = 'used'
  WHERE gp.status = 'expired'
    AND gp.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.entry_logs el
      WHERE el.guest_pass_id = gp.id
        AND el.status = 'completed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. Overstay detection function
--    Called by cron every 5 min
-- ============================================================
CREATE OR REPLACE FUNCTION public.detect_overstays(p_grace_minutes INTEGER DEFAULT 15)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.entry_logs
  SET
    status             = 'overstay',
    overstay_started_at = NOW()
  WHERE status = 'inside'
    AND expected_exit_at IS NOT NULL
    AND expected_exit_at + (p_grace_minutes || ' minutes')::INTERVAL < NOW()
    AND overstay_started_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. verify_guest_token — updated to handle 'used' status
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_guest_token(p_token UUID)
RETURNS JSON AS $$
DECLARE
  v_pass      public.guest_passes%ROWTYPE;
  v_resident  public.profiles%ROWTYPE;
  v_entry     public.entry_logs%ROWTYPE;
BEGIN
  PERFORM public.expire_guest_passes();

  SELECT * INTO v_pass
  FROM public.guest_passes
  WHERE qr_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('valid',false,'status','not_found','message','Guest pass not found');
  END IF;

  SELECT * INTO v_resident FROM public.profiles WHERE id = v_pass.resident_id;

  IF v_pass.archived_at IS NOT NULL THEN
    RETURN json_build_object('valid',false,'status','archived','message','This guest pass has been archived');
  END IF;

  IF v_pass.status = 'revoked' THEN
    RETURN json_build_object('valid',false,'status','revoked','message','This guest pass has been revoked');
  END IF;

  IF v_pass.status = 'used' THEN
    RETURN json_build_object('valid',false,'status','used','message','This pass has already been used');
  END IF;

  IF v_pass.status = 'expired' OR v_pass.expiry_time < NOW() THEN
    RETURN json_build_object('valid',false,'status','expired','message','This guest pass has expired');
  END IF;

  -- Check for active entry (already inside)
  SELECT * INTO v_entry
  FROM public.entry_logs
  WHERE guest_pass_id = v_pass.id
    AND status IN ('inside','overstay')
  ORDER BY entry_time DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'valid',true,
      'status','already_inside',
      'message','Guest is already inside',
      'guest_pass', row_to_json(v_pass),
      'resident', json_build_object(
        'id', v_resident.id,
        'full_name', v_resident.full_name,
        'email', v_resident.email,
        'apartment_number', v_resident.apartment_number,
        'phone_number', v_resident.phone_number
      ),
      'entry_log_id', v_entry.id,
      'entry_time', v_entry.entry_time
    );
  END IF;

  -- Check completed
  SELECT * INTO v_entry
  FROM public.entry_logs
  WHERE guest_pass_id = v_pass.id AND status = 'completed'
  ORDER BY entry_time DESC LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'valid',false,
      'status','completed',
      'message','Guest has already completed their visit',
      'guest_pass', row_to_json(v_pass),
      'entry_log_id', v_entry.id,
      'entry_time', v_entry.entry_time,
      'exit_time', v_entry.exit_time
    );
  END IF;

  RETURN json_build_object(
    'valid',true,
    'status','valid',
    'message','Pass is valid',
    'guest_pass', row_to_json(v_pass),
    'resident', json_build_object(
      'id', v_resident.id,
      'full_name', v_resident.full_name,
      'email', v_resident.email,
      'apartment_number', v_resident.apartment_number,
      'phone_number', v_resident.phone_number
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. RLS — block hard-delete on guest_passes and entry_logs
--    (revoke the delete policies; archiving is done via UPDATE)
-- ============================================================
DROP POLICY IF EXISTS "guest_passes_delete_admin" ON public.guest_passes;
-- entry_logs never had a delete policy; confirm absent:
DROP POLICY IF EXISTS "entry_logs_delete_any" ON public.entry_logs;

-- ============================================================
-- 10. pg_cron jobs (requires pg_cron extension)
--     Run in Supabase dashboard or via service-role if not available
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Expire passes every 5 minutes
    PERFORM cron.schedule(
      'expire-guest-passes',
      '*/5 * * * *',
      'SELECT public.expire_guest_passes()'
    );
    -- Detect overstays every 5 minutes (15-min grace)
    PERFORM cron.schedule(
      'detect-overstays',
      '*/5 * * * *',
      'SELECT public.detect_overstays(15)'
    );
  END IF;
END $$;

-- ============================================================
-- 11. handle_new_user — hardcode role = 'resident' always
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone_number, apartment_number, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone_number',
    NEW.raw_user_meta_data->>'apartment_number',
    'resident',   -- NEVER trust raw_user_meta_data for role
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 12. Guard login: block deactivated profiles at DB level
-- ============================================================
-- Note: Supabase Auth itself still allows login; deactivation is
-- enforced in middleware + layout redirects. The is_active column
-- is the authoritative flag checked server-side.
