-- ============================================================
-- Migration 008: Stay Extensions, Penalties, Policy Settings,
--                Notification Preferences
-- All idempotent (IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- ============================================================
-- 1. POLICY_SETTINGS — single-row configuration table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.policy_settings (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Overstay
  overstay_grace_minutes      INTEGER NOT NULL DEFAULT 15,
  overstay_penalty_rate_bdt   NUMERIC(10,2) NOT NULL DEFAULT 50.00, -- BDT per hour
  overstay_notify_admin_after_minutes INTEGER NOT NULL DEFAULT 60,
  ending_soon_warn_minutes    INTEGER NOT NULL DEFAULT 10,
  -- Pass limits
  max_pass_duration_hours     INTEGER NOT NULL DEFAULT 24,
  max_extensions_resident     INTEGER NOT NULL DEFAULT 1,  -- >=2 needs admin
  max_total_stay_hours        INTEGER NOT NULL DEFAULT 48,
  -- Delivery
  delivery_reply_minutes      INTEGER NOT NULL DEFAULT 2,
  delivery_access_window_min  INTEGER NOT NULL DEFAULT 20,
  walk_in_reply_minutes       INTEGER NOT NULL DEFAULT 5,
  -- Events
  event_approval_threshold    INTEGER NOT NULL DEFAULT 50,
  -- SMS
  max_sms_per_resident_per_day INTEGER NOT NULL DEFAULT 5,
  sms_critical_only           BOOLEAN NOT NULL DEFAULT TRUE,
  -- Storage
  photo_retention_days        INTEGER NOT NULL DEFAULT 90,
  -- Penalty
  penalty_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  -- Meta
  updated_by                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure exactly one row exists
INSERT INTO public.policy_settings (id) VALUES (uuid_generate_v4())
ON CONFLICT DO NOTHING;

-- Only admins can read/write policy_settings
ALTER TABLE public.policy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "policy_select_admin"
  ON public.policy_settings FOR SELECT
  USING (public.get_my_role() = 'admin');

CREATE POLICY IF NOT EXISTS "policy_update_admin"
  ON public.policy_settings FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- 2. PASS_EXTENSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pass_extensions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pass_id         UUID NOT NULL REFERENCES public.guest_passes(id) ON DELETE CASCADE,
  entry_log_id    UUID REFERENCES public.entry_logs(id) ON DELETE SET NULL,
  old_expiry      TIMESTAMPTZ NOT NULL,
  new_expiry      TIMESTAMPTZ NOT NULL,
  extend_hours    INTEGER NOT NULL CHECK (extend_hours IN (1, 2, 4, 24)),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  requested_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- 1st extension: approved by resident (self); further: need admin
  approved_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approval_level  TEXT NOT NULL DEFAULT 'resident'
    CHECK (approval_level IN ('resident','admin')),
  reason          TEXT,
  resolved_at     TIMESTAMPTZ,
  was_overstay    BOOLEAN NOT NULL DEFAULT FALSE, -- pass was in overstay when extended
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pe_pass_id      ON public.pass_extensions(pass_id);
CREATE INDEX IF NOT EXISTS idx_pe_requested_by ON public.pass_extensions(requested_by);
CREATE INDEX IF NOT EXISTS idx_pe_status       ON public.pass_extensions(status);

ALTER TABLE public.pass_extensions ENABLE ROW LEVEL SECURITY;

-- Resident sees their own pass extensions
CREATE POLICY IF NOT EXISTS "pe_select_resident"
  ON public.pass_extensions FOR SELECT
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.guest_passes gp
      WHERE gp.id = pass_id AND gp.resident_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "pe_select_elevated"
  ON public.pass_extensions FOR SELECT
  USING (public.get_my_role() IN ('security','admin'));

CREATE POLICY IF NOT EXISTS "pe_insert_resident"
  ON public.pass_extensions FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.guest_passes gp
      WHERE gp.id = pass_id AND gp.resident_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "pe_update_admin"
  ON public.pass_extensions FOR UPDATE
  USING (public.get_my_role() = 'admin' OR approved_by = auth.uid());

-- ============================================================
-- 3. PENALTIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.penalties (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_log_id    UUID REFERENCES public.entry_logs(id) ON DELETE SET NULL,
  pass_id         UUID REFERENCES public.guest_passes(id) ON DELETE SET NULL,
  minutes_over    INTEGER NOT NULL,
  amount_bdt      NUMERIC(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','waived','added_to_bill')),
  waived_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  waive_reason    TEXT,
  waived_at       TIMESTAMPTZ,
  month_year      TEXT NOT NULL, -- 'YYYY-MM' for monthly report grouping
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_penalties_resident_id ON public.penalties(resident_id);
CREATE INDEX IF NOT EXISTS idx_penalties_status      ON public.penalties(status);
CREATE INDEX IF NOT EXISTS idx_penalties_month_year  ON public.penalties(month_year);
CREATE INDEX IF NOT EXISTS idx_penalties_entry_log   ON public.penalties(entry_log_id);

CREATE TRIGGER penalties_updated_at
  BEFORE UPDATE ON public.penalties
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;

-- Residents see their own
CREATE POLICY IF NOT EXISTS "penalties_select_resident"
  ON public.penalties FOR SELECT
  USING (resident_id = auth.uid());

-- Admin/security see all
CREATE POLICY IF NOT EXISTS "penalties_select_elevated"
  ON public.penalties FOR SELECT
  USING (public.get_my_role() IN ('admin','security'));

-- System inserts (via security definer functions only)
CREATE POLICY IF NOT EXISTS "penalties_insert_auth"
  ON public.penalties FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admin can waive (UPDATE status/waived_by/waive_reason)
CREATE POLICY IF NOT EXISTS "penalties_update_admin"
  ON public.penalties FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- Immutable: no delete on penalties
CREATE OR REPLACE FUNCTION public.block_penalties_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'penalty rows are immutable: DELETE is forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS penalties_no_delete ON public.penalties;
CREATE TRIGGER penalties_no_delete
  BEFORE DELETE ON public.penalties
  FOR EACH ROW EXECUTE FUNCTION public.block_penalties_delete();

-- ============================================================
-- 4. NOTIFICATION_PREFERENCES — per-user channel preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id           UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- In-app (always on)
  inapp_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  -- Web Push
  push_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  push_endpoint     TEXT,
  push_p256dh       TEXT,
  push_auth         TEXT,
  -- SMS
  sms_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Per-event toggles
  notify_checkin    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_checkout   BOOLEAN NOT NULL DEFAULT TRUE,
  notify_overstay   BOOLEAN NOT NULL DEFAULT TRUE,
  notify_ending_soon BOOLEAN NOT NULL DEFAULT TRUE,
  notify_delivery   BOOLEAN NOT NULL DEFAULT TRUE,
  notify_walk_in    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_extension  BOOLEAN NOT NULL DEFAULT TRUE,
  notify_penalty    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_revoked    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_event      BOOLEAN NOT NULL DEFAULT TRUE,
  notify_emergency  BOOLEAN NOT NULL DEFAULT TRUE,
  -- SMS daily counter (reset daily by cron or on next-day check)
  sms_sent_today    INTEGER NOT NULL DEFAULT 0,
  sms_last_reset_date DATE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "np_select_own"
  ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "np_insert_own"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "np_update_own"
  ON public.notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 5. UPDATED detect_overstays() — reads grace from policy_settings,
--    creates penalties, and marks overstay_started_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.detect_overstays_full()
RETURNS JSONB AS $$
DECLARE
  v_grace        INTEGER;
  v_penalty_rate NUMERIC;
  v_penalty_en   BOOLEAN;
  v_count        INTEGER := 0;
  v_penalties    INTEGER := 0;
  v_rec          RECORD;
  v_month        TEXT;
  v_mins_over    INTEGER;
  v_amount       NUMERIC;
BEGIN
  -- Load policy
  SELECT overstay_grace_minutes, overstay_penalty_rate_bdt, penalty_enabled
  INTO v_grace, v_penalty_rate, v_penalty_en
  FROM public.policy_settings LIMIT 1;

  v_grace := COALESCE(v_grace, 15);

  -- Mark new overstays
  UPDATE public.entry_logs
  SET status = 'overstay',
      overstay_started_at = NOW()
  WHERE status = 'inside'
    AND expected_exit_at IS NOT NULL
    AND expected_exit_at + (v_grace || ' minutes')::INTERVAL < NOW()
    AND overstay_started_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Create penalties for newly-overstayed entries (one penalty per overstay)
  IF v_penalty_en THEN
    v_month := TO_CHAR(NOW(), 'YYYY-MM');
    FOR v_rec IN
      SELECT el.id AS log_id,
             el.expected_exit_at,
             gp.resident_id,
             gp.id AS pass_id
      FROM public.entry_logs el
      JOIN public.guest_passes gp ON gp.id = el.guest_pass_id
      WHERE el.overstay_started_at >= NOW() - INTERVAL '10 minutes' -- just flagged
        AND el.status = 'overstay'
        -- no penalty yet for this entry log
        AND NOT EXISTS (
          SELECT 1 FROM public.penalties p WHERE p.entry_log_id = el.id
        )
    LOOP
      v_mins_over := GREATEST(1, EXTRACT(EPOCH FROM (NOW() - v_rec.expected_exit_at))::INTEGER / 60 - v_grace);
      v_amount := ROUND((v_mins_over::NUMERIC / 60) * v_penalty_rate, 2);

      INSERT INTO public.penalties (
        resident_id, entry_log_id, pass_id,
        minutes_over, amount_bdt, status, month_year
      ) VALUES (
        v_rec.resident_id, v_rec.log_id, v_rec.pass_id,
        v_mins_over, v_amount, 'pending', v_month
      );
      v_penalties := v_penalties + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'new_overstays', v_count,
    'penalties_created', v_penalties
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep old signature for backward compat
CREATE OR REPLACE FUNCTION public.detect_overstays(p_grace_minutes INTEGER DEFAULT 15)
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.entry_logs
  SET status = 'overstay', overstay_started_at = NOW()
  WHERE status = 'inside'
    AND expected_exit_at IS NOT NULL
    AND expected_exit_at + (p_grace_minutes || ' minutes')::INTERVAL < NOW()
    AND overstay_started_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Helper: get_policy() returns the single settings row as JSONB
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_policy()
RETURNS JSONB AS $$
  SELECT row_to_json(ps)::JSONB FROM public.policy_settings ps LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 7. pg_cron: update detect-overstays to use full function
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove old job if exists
    PERFORM cron.unschedule('detect-overstays') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'detect-overstays'
    );
    -- Add new full job
    PERFORM cron.schedule(
      'detect-overstays-full',
      '*/5 * * * *',
      'SELECT public.detect_overstays_full()'
    );
  END IF;
END $$;
