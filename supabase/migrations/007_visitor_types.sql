-- ============================================================
-- Migration 007: Visitor Types
-- recurring_visitors, visit_requests (delivery/walk-in/emergency),
-- events + event_guests + event_coordinators, blacklist,
-- entry_logs extended with visitor_type + visit_request_id
-- ============================================================

-- ============================================================
-- 1. VISITOR TYPE ENUM (stored as TEXT CHECK)
-- ============================================================
-- Types: one_time, recurring, delivery, minor_family, event, walk_in, emergency

ALTER TABLE public.entry_logs
  ADD COLUMN IF NOT EXISTS visitor_type TEXT
    CHECK (visitor_type IN ('one_time','recurring','delivery','minor_family','event','walk_in','emergency'))
    DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS visit_request_id UUID;  -- FK added after table creation

-- ============================================================
-- 2. RECURRING VISITORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recurring_visitors (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_id      TEXT NOT NULL UNIQUE,  -- e.g. RV-2045
  full_name     TEXT NOT NULL,
  photo_url     TEXT,
  phone         TEXT,
  role          TEXT NOT NULL,  -- maid, driver, cook, tutor, caretaker, other
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','blacklisted')),
  valid_until   DATE,           -- NULL = indefinite
  added_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rv_short_id   ON public.recurring_visitors(short_id);
CREATE INDEX IF NOT EXISTS idx_rv_full_name  ON public.recurring_visitors(full_name);
CREATE INDEX IF NOT EXISTS idx_rv_status     ON public.recurring_visitors(status);
CREATE INDEX IF NOT EXISTS idx_rv_added_by   ON public.recurring_visitors(added_by);

CREATE TRIGGER rv_updated_at
  BEFORE UPDATE ON public.recurring_visitors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Junction: one visitor can work in multiple apartments
CREATE TABLE IF NOT EXISTS public.recurring_visitor_apartments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id      UUID NOT NULL REFERENCES public.recurring_visitors(id) ON DELETE CASCADE,
  apartment       TEXT NOT NULL,
  resident_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- schedule: {"days":["Mon","Wed","Fri"],"start":"08:00","end":"17:00"}
  schedule        JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  approved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visitor_id, apartment)
);

CREATE INDEX IF NOT EXISTS idx_rva_visitor_id   ON public.recurring_visitor_apartments(visitor_id);
CREATE INDEX IF NOT EXISTS idx_rva_resident_id  ON public.recurring_visitor_apartments(resident_id);
CREATE INDEX IF NOT EXISTS idx_rva_apartment    ON public.recurring_visitor_apartments(apartment);

-- ============================================================
-- 3. VISIT REQUESTS (delivery / walk-in / emergency)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.visit_requests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type              TEXT NOT NULL
    CHECK (type IN ('delivery','walk_in','emergency')),
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired','completed','leave_at_gate')),
  -- common fields
  visitor_name      TEXT NOT NULL,
  visitor_phone     TEXT,
  destination_apt   TEXT NOT NULL,
  resident_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guard_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose           TEXT,
  notes             TEXT,
  -- delivery-specific
  platform          TEXT,  -- Foodpanda, Pathao Food, Daraz, etc.
  -- emergency-specific
  emergency_type    TEXT,  -- doctor, ambulance, fire, police, other
  -- approval tracking
  responded_at      TIMESTAMPTZ,
  responded_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- access window after approval
  access_window_min INTEGER NOT NULL DEFAULT 20,
  expires_at        TIMESTAMPTZ,   -- set on creation for delivery (NOW + 2 min for resident reply)
  entry_allowed_until TIMESTAMPTZ, -- set on approval (NOW + access_window_min)
  -- auto-allow flag
  auto_approved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vr_resident_id  ON public.visit_requests(resident_id);
CREATE INDEX IF NOT EXISTS idx_vr_guard_id     ON public.visit_requests(guard_id);
CREATE INDEX IF NOT EXISTS idx_vr_status       ON public.visit_requests(status);
CREATE INDEX IF NOT EXISTS idx_vr_type         ON public.visit_requests(type);
CREATE INDEX IF NOT EXISTS idx_vr_created_at   ON public.visit_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vr_expires_at   ON public.visit_requests(expires_at);

CREATE TRIGGER vr_updated_at
  BEFORE UPDATE ON public.visit_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add FK from entry_logs to visit_requests
ALTER TABLE public.entry_logs
  ADD CONSTRAINT fk_entry_logs_visit_request
  FOREIGN KEY (visit_request_id) REFERENCES public.visit_requests(id) ON DELETE SET NULL;

-- ============================================================
-- 4. RESIDENT AUTO-ALLOW DELIVERY WINDOW
-- ============================================================
-- Stored in profiles as a JSONB column for simplicity
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS delivery_auto_allow_until TIMESTAMPTZ;

-- ============================================================
-- 5. EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  event_type        TEXT NOT NULL
    CHECK (event_type IN ('wedding','birthday','puja','eid_gathering','corporate','other')),
  apartment         TEXT NOT NULL,
  event_date        DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  expected_count    INTEGER NOT NULL DEFAULT 10,
  max_capacity      INTEGER NOT NULL DEFAULT 50,
  -- approval
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,  -- auto-set if expected_count > 50
  approval_status   TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','rejected','not_required')),
  approved_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  -- counter pass (single QR for all unlisted guests)
  counter_token     UUID UNIQUE DEFAULT uuid_generate_v4(),
  counter_admitted  INTEGER NOT NULL DEFAULT 0,
  -- status
  status            TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','active','completed','cancelled')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_resident_id ON public.events(resident_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date  ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status      ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_approval    ON public.events(approval_status);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 6. EVENT GUESTS (named guest list)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_guests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  qr_token    UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  gate_code   TEXT,
  status      TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','arrived','no_show')),
  arrived_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eg_event_id  ON public.event_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_eg_qr_token  ON public.event_guests(qr_token);
CREATE INDEX IF NOT EXISTS idx_eg_gate_code ON public.event_guests(gate_code);
CREATE INDEX IF NOT EXISTS idx_eg_status    ON public.event_guests(status);

-- ============================================================
-- 7. EVENT COORDINATORS (resident delegates)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_coordinators (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_ec_event_id ON public.event_coordinators(event_id);

-- ============================================================
-- 8. BLACKLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blacklist (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  phone       TEXT,
  photo_url   TEXT,
  reason      TEXT NOT NULL,
  scope       TEXT NOT NULL DEFAULT 'building'
    CHECK (scope IN ('building','apartment')),  -- building=admin, apartment=resident
  added_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  apartment   TEXT,    -- only for apartment-scoped entries
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blacklist_name     ON public.blacklist(name);
CREATE INDEX IF NOT EXISTS idx_blacklist_phone    ON public.blacklist(phone);
CREATE INDEX IF NOT EXISTS idx_blacklist_active   ON public.blacklist(is_active);
CREATE INDEX IF NOT EXISTS idx_blacklist_added_by ON public.blacklist(added_by);

CREATE TRIGGER blacklist_updated_at
  BEFORE UPDATE ON public.blacklist
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 9. RECURRING VISITOR ENTRY LOGS (separate lightweight table)
-- The main entry_logs table also accepts visitor_type='recurring'
-- but recurring visitors use a lighter join
-- ============================================================
-- (Handled by entry_logs.visitor_type = 'recurring' +
--  entry_logs.visit_request_id = NULL +
--  new column recurring_visitor_id)

ALTER TABLE public.entry_logs
  ADD COLUMN IF NOT EXISTS recurring_visitor_id UUID
    REFERENCES public.recurring_visitors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_el_recurring_visitor ON public.entry_logs(recurring_visitor_id);

-- ============================================================
-- 10. RLS POLICIES
-- ============================================================

-- ── recurring_visitors ──────────────────────────────────────
ALTER TABLE public.recurring_visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "rv_select_resident"
  ON public.recurring_visitors FOR SELECT
  USING (
    added_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.recurring_visitor_apartments rva
      WHERE rva.visitor_id = id AND rva.resident_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "rv_select_elevated"
  ON public.recurring_visitors FOR SELECT
  USING (public.get_my_role() IN ('security','admin'));

CREATE POLICY IF NOT EXISTS "rv_insert_resident"
  ON public.recurring_visitors FOR INSERT
  WITH CHECK (added_by = auth.uid() AND public.get_my_role() = 'resident');

CREATE POLICY IF NOT EXISTS "rv_update_own"
  ON public.recurring_visitors FOR UPDATE
  USING (added_by = auth.uid() OR public.get_my_role() = 'admin');

-- ── recurring_visitor_apartments ────────────────────────────
ALTER TABLE public.recurring_visitor_apartments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "rva_select_own"
  ON public.recurring_visitor_apartments FOR SELECT
  USING (resident_id = auth.uid() OR public.get_my_role() IN ('security','admin'));

CREATE POLICY IF NOT EXISTS "rva_insert_resident"
  ON public.recurring_visitor_apartments FOR INSERT
  WITH CHECK (resident_id = auth.uid());

CREATE POLICY IF NOT EXISTS "rva_update_resident"
  ON public.recurring_visitor_apartments FOR UPDATE
  USING (resident_id = auth.uid() OR public.get_my_role() = 'admin');

-- ── visit_requests ───────────────────────────────────────────
ALTER TABLE public.visit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "vr_select_resident"
  ON public.visit_requests FOR SELECT
  USING (resident_id = auth.uid());

CREATE POLICY IF NOT EXISTS "vr_select_guard_admin"
  ON public.visit_requests FOR SELECT
  USING (guard_id = auth.uid() OR public.get_my_role() = 'admin');

CREATE POLICY IF NOT EXISTS "vr_insert_guard"
  ON public.visit_requests FOR INSERT
  WITH CHECK (
    guard_id = auth.uid()
    AND public.get_my_role() IN ('security','admin')
  );

CREATE POLICY IF NOT EXISTS "vr_update_resident"
  ON public.visit_requests FOR UPDATE
  USING (resident_id = auth.uid() OR public.get_my_role() IN ('security','admin'));

-- ── events ───────────────────────────────────────────────────
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "events_select_resident"
  ON public.events FOR SELECT
  USING (resident_id = auth.uid());

CREATE POLICY IF NOT EXISTS "events_select_elevated"
  ON public.events FOR SELECT
  USING (public.get_my_role() IN ('security','admin'));

CREATE POLICY IF NOT EXISTS "events_insert_resident"
  ON public.events FOR INSERT
  WITH CHECK (resident_id = auth.uid() AND public.get_my_role() = 'resident');

CREATE POLICY IF NOT EXISTS "events_update_own"
  ON public.events FOR UPDATE
  USING (resident_id = auth.uid() OR public.get_my_role() = 'admin');

-- ── event_guests ─────────────────────────────────────────────
ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "eg_select_resident"
  ON public.event_guests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.resident_id = auth.uid())
    OR public.get_my_role() IN ('security','admin')
  );

CREATE POLICY IF NOT EXISTS "eg_insert_resident"
  ON public.event_guests FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.resident_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "eg_update_elevated"
  ON public.event_guests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.resident_id = auth.uid())
    OR public.get_my_role() IN ('security','admin')
  );

-- ── event_coordinators ──────────────────────────────────────
ALTER TABLE public.event_coordinators ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "ec_select_own"
  ON public.event_coordinators FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.resident_id = auth.uid())
    OR public.get_my_role() IN ('security','admin')
  );

CREATE POLICY IF NOT EXISTS "ec_insert_resident"
  ON public.event_coordinators FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.resident_id = auth.uid())
  );

-- ── blacklist ─────────────────────────────────────────────────
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "bl_select_elevated"
  ON public.blacklist FOR SELECT
  USING (public.get_my_role() IN ('security','admin'));

CREATE POLICY IF NOT EXISTS "bl_select_resident_own"
  ON public.blacklist FOR SELECT
  USING (added_by = auth.uid());

CREATE POLICY IF NOT EXISTS "bl_insert_auth"
  ON public.blacklist FOR INSERT
  WITH CHECK (added_by = auth.uid());

CREATE POLICY IF NOT EXISTS "bl_update_own"
  ON public.blacklist FOR UPDATE
  USING (added_by = auth.uid() OR public.get_my_role() = 'admin');

-- ============================================================
-- 11. HELPER FUNCTION: expire pending visit_requests
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_visit_requests()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.visit_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 12. HELPER: generate unique short_id for recurring visitors
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_rv_short_id()
RETURNS TEXT AS $$
DECLARE
  v_id TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_id := 'RV-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.recurring_visitors WHERE short_id = v_id) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 13. CRON: expire visit requests every 2 minutes (if pg_cron available)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-visit-requests',
      '*/2 * * * *',
      'SELECT public.expire_visit_requests()'
    );
  END IF;
END $$;
