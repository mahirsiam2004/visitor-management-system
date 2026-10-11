-- ============================================================
-- Migration 006: Anti-misuse features
-- Headcount limits, time-window, gate code, companions,
-- access attempts, notifications, revoke provenance,
-- entry photo, rate-limit tracking
-- All statements are idempotent (IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- ============================================================
-- 1. GUEST_PASSES — new columns
-- ============================================================
ALTER TABLE public.guest_passes
  ADD COLUMN IF NOT EXISTS allowed_persons  INTEGER NOT NULL DEFAULT 1
    CHECK (allowed_persons BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS entered_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gate_code        TEXT,          -- 6-digit code, unique per active pass
  ADD COLUMN IF NOT EXISTS valid_from       TIMESTAMPTZ,   -- window open time (visit_time - 30 min)
  ADD COLUMN IF NOT EXISTS revoked_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoke_reason    TEXT,
  ADD COLUMN IF NOT EXISTS guest_photo_url  TEXT;          -- optional photo uploaded by resident

-- gate_code must be unique among non-archived, non-revoked passes
CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_passes_gate_code
  ON public.guest_passes (gate_code)
  WHERE gate_code IS NOT NULL AND archived_at IS NULL AND status NOT IN ('expired','revoked','used');

CREATE INDEX IF NOT EXISTS idx_guest_passes_valid_from  ON public.guest_passes(valid_from);
CREATE INDEX IF NOT EXISTS idx_guest_passes_gate_code_plain ON public.guest_passes(gate_code);

-- ============================================================
-- 2. ENTRY_LOGS — identity verification & photo
-- ============================================================
ALTER TABLE public.entry_logs
  ADD COLUMN IF NOT EXISTS id_type          TEXT
    CHECK (id_type IN ('nid','driving_license','student_id','known_to_resident','none')),
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entry_photo_url  TEXT,          -- guard-captured photo (Supabase Storage)
  ADD COLUMN IF NOT EXISTS persons_admitted INTEGER NOT NULL DEFAULT 1;

-- ============================================================
-- 3. GUEST_PASS_MEMBERS — pre-registered companions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guest_pass_members (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_pass_id  UUID NOT NULL REFERENCES public.guest_passes(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  relation       TEXT NOT NULL,        -- e.g. 'parent', 'friend', 'spouse'
  is_minor       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_pass_members_pass_id
  ON public.guest_pass_members(guest_pass_id);

ALTER TABLE public.guest_pass_members ENABLE ROW LEVEL SECURITY;

-- Residents see their own pass members
CREATE POLICY IF NOT EXISTS "gpm_select_resident"
  ON public.guest_pass_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.guest_passes gp
      WHERE gp.id = guest_pass_id AND gp.resident_id = auth.uid()
    )
  );

-- Security/admin see all
CREATE POLICY IF NOT EXISTS "gpm_select_elevated"
  ON public.guest_pass_members FOR SELECT
  USING (public.get_my_role() IN ('security','admin'));

-- Residents insert for their own passes
CREATE POLICY IF NOT EXISTS "gpm_insert_resident"
  ON public.guest_pass_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.guest_passes gp
      WHERE gp.id = guest_pass_id AND gp.resident_id = auth.uid()
    )
  );

-- ============================================================
-- 4. ACCESS_ATTEMPTS — every deny / suspicious scan is logged
-- ============================================================
CREATE TABLE IF NOT EXISTS public.access_attempts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_used   TEXT,                   -- raw token or gate_code presented
  result       TEXT NOT NULL
    CHECK (result IN (
      'invalid','expired','revoked','limit_exceeded',
      'too_early','outside_schedule','already_inside',
      'rate_limited','pass_not_found','archived','used'
    )),
  guard_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  pass_id      UUID REFERENCES public.guest_passes(id) ON DELETE SET NULL,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_attempts_guard_id  ON public.access_attempts(guard_id);
CREATE INDEX IF NOT EXISTS idx_access_attempts_pass_id   ON public.access_attempts(pass_id);
CREATE INDEX IF NOT EXISTS idx_access_attempts_created_at ON public.access_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_access_attempts_result    ON public.access_attempts(result);

ALTER TABLE public.access_attempts ENABLE ROW LEVEL SECURITY;

-- Only security/admin can read
CREATE POLICY IF NOT EXISTS "access_attempts_select_elevated"
  ON public.access_attempts FOR SELECT
  USING (public.get_my_role() IN ('security','admin'));

-- Guards and server can insert
CREATE POLICY IF NOT EXISTS "access_attempts_insert_auth"
  ON public.access_attempts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Immutable: no UPDATE or DELETE on access_attempts
CREATE OR REPLACE FUNCTION public.block_access_attempts_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'access_attempts rows are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS access_attempts_no_update ON public.access_attempts;
CREATE TRIGGER access_attempts_no_update
  BEFORE UPDATE ON public.access_attempts
  FOR EACH ROW EXECUTE FUNCTION public.block_access_attempts_mutation();

DROP TRIGGER IF EXISTS access_attempts_no_delete ON public.access_attempts;
CREATE TRIGGER access_attempts_no_delete
  BEFORE DELETE ON public.access_attempts
  FOR EACH ROW EXECUTE FUNCTION public.block_access_attempts_mutation();

-- ============================================================
-- 5. GUARD_RATE_LIMITS — per-guard token lookup counters
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guard_rate_limits (
  guard_id     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until  TIMESTAMPTZ
);

ALTER TABLE public.guard_rate_limits ENABLE ROW LEVEL SECURITY;

-- Guards can read/upsert their own row
CREATE POLICY IF NOT EXISTS "rate_limits_own"
  ON public.guard_rate_limits FOR ALL
  USING (guard_id = auth.uid())
  WITH CHECK (guard_id = auth.uid());

-- ============================================================
-- 6. NOTIFICATIONS — in-app + realtime
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,          -- 'checkin', 'overstay', 'revoked', 'system'
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at   ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications
CREATE POLICY IF NOT EXISTS "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());

-- Any authenticated user can insert (server actions use anon key)
CREATE POLICY IF NOT EXISTS "notifications_insert_auth"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can mark their own as read
CREATE POLICY IF NOT EXISTS "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- ============================================================
-- 7. STORAGE BUCKET — entry-photos (defined here as a comment;
--    create the bucket manually in Supabase dashboard or via CLI)
-- ============================================================
-- Bucket name : entry-photos
-- Public      : false (private)
-- Allowed MIME: image/jpeg, image/png, image/webp
-- Max size    : 5 MB
-- RLS policies on storage.objects:
--   INSERT : auth.uid() IS NOT NULL AND (get_my_role() IN ('security','admin'))
--   SELECT : get_my_role() IN ('security','admin')
--   DELETE : get_my_role() = 'admin'        (for retention cleanup)
--
-- Bucket name : guest-photos
-- Public      : false (private)
-- Same policies but residents can INSERT for their own passes.

-- ============================================================
-- 8. Updated verify_guest_token — supports gate_code lookup,
--    enforces valid_from window, returns new fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_guest_token(p_token TEXT)
RETURNS JSON AS $$
DECLARE
  v_pass      public.guest_passes%ROWTYPE;
  v_resident  public.profiles%ROWTYPE;
  v_entry     public.entry_logs%ROWTYPE;
  v_members   JSON;
BEGIN
  PERFORM public.expire_guest_passes();

  -- Look up by QR token (UUID) first, then by gate_code
  SELECT * INTO v_pass
  FROM public.guest_passes
  WHERE qr_token::TEXT = p_token
     OR gate_code = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid',false,'status','not_found','message','Guest pass not found'
    );
  END IF;

  SELECT * INTO v_resident FROM public.profiles WHERE id = v_pass.resident_id;

  -- Soft-deleted
  IF v_pass.archived_at IS NOT NULL THEN
    RETURN json_build_object('valid',false,'status','archived','message','This guest pass has been archived');
  END IF;

  -- Revoked
  IF v_pass.status = 'revoked' THEN
    RETURN json_build_object('valid',false,'status','revoked','message','This guest pass has been revoked by the resident');
  END IF;

  -- Used (single-use exhausted)
  IF v_pass.status = 'used' THEN
    RETURN json_build_object('valid',false,'status','used','message','This pass has already been used');
  END IF;

  -- Time window: too early
  IF v_pass.valid_from IS NOT NULL AND NOW() < v_pass.valid_from THEN
    RETURN json_build_object(
      'valid',false,'status','too_early',
      'message','Too early — pass is valid from ' || to_char(v_pass.valid_from AT TIME ZONE 'Asia/Dhaka','DD Mon YYYY HH12:MI AM'),
      'valid_from', v_pass.valid_from
    );
  END IF;

  -- Expired
  IF v_pass.status = 'expired' OR v_pass.expiry_time < NOW() THEN
    RETURN json_build_object('valid',false,'status','expired','message','This guest pass has expired');
  END IF;

  -- Headcount limit reached
  IF v_pass.entered_count >= v_pass.allowed_persons THEN
    RETURN json_build_object(
      'valid',false,'status','limit_exceeded',
      'message','Visitor limit reached (' || v_pass.entered_count || '/' || v_pass.allowed_persons || ')'
    );
  END IF;

  -- Get members
  SELECT json_agg(json_build_object(
    'id', id, 'full_name', full_name,
    'relation', relation, 'is_minor', is_minor
  ))
  INTO v_members
  FROM public.guest_pass_members
  WHERE guest_pass_id = v_pass.id;

  -- Already inside?
  SELECT * INTO v_entry
  FROM public.entry_logs
  WHERE guest_pass_id = v_pass.id AND status IN ('inside','overstay')
  ORDER BY entry_time DESC LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'valid',true,'status','already_inside',
      'message','Guest is already inside',
      'guest_pass', row_to_json(v_pass),
      'resident', json_build_object(
        'id', v_resident.id, 'full_name', v_resident.full_name,
        'email', v_resident.email, 'apartment_number', v_resident.apartment_number,
        'phone_number', v_resident.phone_number
      ),
      'members', COALESCE(v_members, '[]'::json),
      'entry_log_id', v_entry.id,
      'entry_time', v_entry.entry_time
    );
  END IF;

  -- Completed visit?
  SELECT * INTO v_entry
  FROM public.entry_logs
  WHERE guest_pass_id = v_pass.id AND status = 'completed'
  ORDER BY entry_time DESC LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'valid',false,'status','completed',
      'message','Guest has already completed their visit',
      'guest_pass', row_to_json(v_pass),
      'entry_log_id', v_entry.id,
      'entry_time', v_entry.entry_time,
      'exit_time', v_entry.exit_time
    );
  END IF;

  -- Valid
  RETURN json_build_object(
    'valid',true,'status','valid',
    'message','Pass is valid',
    'guest_pass', row_to_json(v_pass),
    'resident', json_build_object(
      'id', v_resident.id, 'full_name', v_resident.full_name,
      'email', v_resident.email, 'apartment_number', v_resident.apartment_number,
      'phone_number', v_resident.phone_number
    ),
    'members', COALESCE(v_members, '[]'::json),
    'persons_remaining', v_pass.allowed_persons - v_pass.entered_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
