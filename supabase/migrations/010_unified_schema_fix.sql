-- ============================================================================
-- Migration 010: Unified Schema Fix & Full Integrity Alignment
-- Idempotent: safe to run multiple times.
-- Uses: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. UTILITY FUNCTIONS & ROLE CHECKER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- 2. CORE ENUMS & BASE TABLES
-- ============================================================================

-- ── BUILDINGS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.buildings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  address     TEXT NOT NULL,
  city        TEXT NOT NULL DEFAULT 'Dhaka',
  country     TEXT NOT NULL DEFAULT 'Bangladesh',
  code        TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS buildings_updated_at ON public.buildings;
CREATE TRIGGER buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.buildings (id, name, address, code)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'SecureEntry Main',
  'Dhaka, Bangladesh',
  'MAIN'
)
ON CONFLICT (id) DO NOTHING;

-- ── PROFILES ────────────────────────────────────────────────────────────────
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

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS delivery_auto_allow_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.profiles SET building_id = '00000000-0000-0000-0000-000000000001' WHERE building_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_building ON public.profiles(building_id);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── APARTMENTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.apartments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id  UUID REFERENCES public.buildings(id) ON DELETE SET NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  block        TEXT NOT NULL,
  floor        INTEGER NOT NULL DEFAULT 1,
  unit         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'occupied' CHECK (status IN ('occupied', 'vacant', 'maintenance')),
  resident_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_apartments_block_unit UNIQUE (building_id, block, unit)
);

CREATE INDEX IF NOT EXISTS idx_apartments_building ON public.apartments(building_id);
CREATE INDEX IF NOT EXISTS idx_apartments_resident ON public.apartments(resident_id);

DROP TRIGGER IF EXISTS apartments_updated_at ON public.apartments;
CREATE TRIGGER apartments_updated_at
  BEFORE UPDATE ON public.apartments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed distinct apartment units from existing profiles if none exist
INSERT INTO public.apartments (building_id, block, floor, unit, status)
SELECT DISTINCT
  '00000000-0000-0000-0000-000000000001'::uuid,
  COALESCE(NULLIF(SPLIT_PART(apartment_number, '-', 1), ''), 'A'),
  1,
  COALESCE(NULLIF(apartment_number, ''), '101'),
  'occupied'
FROM public.profiles
WHERE apartment_number IS NOT NULL AND TRIM(apartment_number) != ''
ON CONFLICT (building_id, block, unit) DO NOTHING;

-- ── GUEST PASSES ────────────────────────────────────────────────────────────
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
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'revoked', 'used')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.guest_passes
  ADD COLUMN IF NOT EXISTS allowed_persons INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS entered_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gate_code TEXT,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guest_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS guest_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoke_reason TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT,
  ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.guest_passes SET building_id = '00000000-0000-0000-0000-000000000001' WHERE building_id IS NULL;

-- Update status check constraint if it previously only had 3 values
ALTER TABLE public.guest_passes DROP CONSTRAINT IF EXISTS guest_passes_status_check;
ALTER TABLE public.guest_passes
  ADD CONSTRAINT guest_passes_status_check
  CHECK (status IN ('valid', 'expired', 'revoked', 'used'));

CREATE INDEX IF NOT EXISTS idx_guest_passes_resident_id ON public.guest_passes(resident_id);
CREATE INDEX IF NOT EXISTS idx_guest_passes_qr_token ON public.guest_passes(qr_token);
CREATE INDEX IF NOT EXISTS idx_guest_passes_status ON public.guest_passes(status);
CREATE INDEX IF NOT EXISTS idx_guest_passes_visit_date ON public.guest_passes(visit_date);
CREATE INDEX IF NOT EXISTS idx_guest_passes_expiry_time ON public.guest_passes(expiry_time);
CREATE INDEX IF NOT EXISTS idx_guest_passes_valid_from ON public.guest_passes(valid_from);
CREATE INDEX IF NOT EXISTS idx_guest_passes_gate_code_plain ON public.guest_passes(gate_code);

DROP TRIGGER IF EXISTS guest_passes_updated_at ON public.guest_passes;
CREATE TRIGGER guest_passes_updated_at
  BEFORE UPDATE ON public.guest_passes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── ENTRY LOGS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.entry_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_pass_id UUID REFERENCES public.guest_passes(id) ON DELETE RESTRICT,
  security_guard_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'inside' CHECK (status IN ('inside', 'completed', 'overstay')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.entry_logs
  ADD COLUMN IF NOT EXISTS expected_exit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overstay_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_type TEXT CHECK (checkout_type IN ('manual','auto_closed','admin_closed') OR checkout_type IS NULL),
  ADD COLUMN IF NOT EXISTS persons_admitted INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS id_type TEXT,
  ADD COLUMN IF NOT EXISTS identity_id_type TEXT,
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entry_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS entry_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS visitor_type TEXT NOT NULL DEFAULT 'one_time' CHECK (visitor_type IN ('one_time','recurring','delivery','minor_family','event','walk_in','emergency')),
  ADD COLUMN IF NOT EXISTS guard_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS visit_request_id UUID,
  ADD COLUMN IF NOT EXISTS recurring_visitor_id UUID,
  ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  ADD COLUMN IF NOT EXISTS gate TEXT,
  ADD COLUMN IF NOT EXISTS shift TEXT CHECK (shift IN ('morning','day','evening','night') OR shift IS NULL);

ALTER TABLE public.entry_logs DROP CONSTRAINT IF EXISTS entry_logs_status_check;
ALTER TABLE public.entry_logs
  ADD CONSTRAINT entry_logs_status_check
  CHECK (status IN ('inside', 'completed', 'overstay'));

-- Ensure FK on guest_pass_id is RESTRICT (evidence preservation)
ALTER TABLE public.entry_logs DROP CONSTRAINT IF EXISTS entry_logs_guest_pass_id_fkey;
ALTER TABLE public.entry_logs
  ADD CONSTRAINT entry_logs_guest_pass_id_fkey
  FOREIGN KEY (guest_pass_id) REFERENCES public.guest_passes(id) ON DELETE RESTRICT;

ALTER TABLE public.entry_logs DROP CONSTRAINT IF EXISTS entry_logs_security_guard_id_fkey;
ALTER TABLE public.entry_logs
  ADD CONSTRAINT entry_logs_security_guard_id_fkey
  FOREIGN KEY (security_guard_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_entry_logs_guest_pass_id ON public.entry_logs(guest_pass_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_security_guard_id ON public.entry_logs(security_guard_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_guard_id ON public.entry_logs(guard_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_status ON public.entry_logs(status);
CREATE INDEX IF NOT EXISTS idx_entry_logs_entry_time ON public.entry_logs(entry_time);
CREATE INDEX IF NOT EXISTS idx_entry_logs_building ON public.entry_logs(building_id);

DROP TRIGGER IF EXISTS entry_logs_updated_at ON public.entry_logs;
CREATE TRIGGER entry_logs_updated_at
  BEFORE UPDATE ON public.entry_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── PASS EXTENSIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pass_extensions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pass_id         UUID NOT NULL REFERENCES public.guest_passes(id) ON DELETE RESTRICT,
  entry_log_id    UUID REFERENCES public.entry_logs(id) ON DELETE SET NULL,
  old_expiry      TIMESTAMPTZ NOT NULL,
  new_expiry      TIMESTAMPTZ NOT NULL,
  extend_hours    INTEGER NOT NULL CHECK (extend_hours IN (1, 2, 4, 24)),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  approved_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approval_level  TEXT NOT NULL DEFAULT 'resident' CHECK (approval_level IN ('resident','admin')),
  reason          TEXT,
  resolved_at     TIMESTAMPTZ,
  was_overstay    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pe_pass_id      ON public.pass_extensions(pass_id);
CREATE INDEX IF NOT EXISTS idx_pe_requested_by ON public.pass_extensions(requested_by);
CREATE INDEX IF NOT EXISTS idx_pe_status       ON public.pass_extensions(status);

-- ── PENALTIES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.penalties (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_log_id    UUID REFERENCES public.entry_logs(id) ON DELETE RESTRICT,
  pass_id         UUID REFERENCES public.guest_passes(id) ON DELETE RESTRICT,
  minutes_over    INTEGER NOT NULL,
  amount_bdt      NUMERIC(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','waived','added_to_bill')),
  waived_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  waive_reason    TEXT,
  waived_at       TIMESTAMPTZ,
  month_year      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_penalties_resident_id ON public.penalties(resident_id);
CREATE INDEX IF NOT EXISTS idx_penalties_status      ON public.penalties(status);
CREATE INDEX IF NOT EXISTS idx_penalties_month_year  ON public.penalties(month_year);
CREATE INDEX IF NOT EXISTS idx_penalties_entry_log   ON public.penalties(entry_log_id);

DROP TRIGGER IF EXISTS penalties_updated_at ON public.penalties;
CREATE TRIGGER penalties_updated_at
  BEFORE UPDATE ON public.penalties
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── POLICY SETTINGS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.policy_settings (
  id                                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  overstay_grace_minutes              INTEGER NOT NULL DEFAULT 15,
  overstay_penalty_rate_bdt           NUMERIC(10,2) NOT NULL DEFAULT 50.00,
  overstay_notify_admin_after_minutes INTEGER NOT NULL DEFAULT 60,
  ending_soon_warn_minutes            INTEGER NOT NULL DEFAULT 10,
  max_pass_duration_hours             INTEGER NOT NULL DEFAULT 24,
  max_extensions_resident             INTEGER NOT NULL DEFAULT 1,
  max_total_stay_hours                INTEGER NOT NULL DEFAULT 48,
  delivery_reply_minutes              INTEGER NOT NULL DEFAULT 2,
  delivery_access_window_min          INTEGER NOT NULL DEFAULT 20,
  walk_in_reply_minutes               INTEGER NOT NULL DEFAULT 5,
  event_approval_threshold            INTEGER NOT NULL DEFAULT 50,
  max_sms_per_resident_per_day        INTEGER NOT NULL DEFAULT 5,
  sms_critical_only                   BOOLEAN NOT NULL DEFAULT TRUE,
  photo_retention_days                INTEGER NOT NULL DEFAULT 90,
  penalty_enabled                     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by                          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.policy_settings (id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (SELECT 1 FROM public.policy_settings);

-- ── NOTIFICATIONS & PREFERENCES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at   ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON public.notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id             UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  inapp_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  push_endpoint       TEXT,
  push_p256dh         TEXT,
  push_auth           TEXT,
  sms_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_checkin      BOOLEAN NOT NULL DEFAULT TRUE,
  notify_checkout     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_overstay     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_ending_soon  BOOLEAN NOT NULL DEFAULT TRUE,
  notify_delivery     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_walk_in      BOOLEAN NOT NULL DEFAULT TRUE,
  notify_extension    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_penalty      BOOLEAN NOT NULL DEFAULT TRUE,
  notify_revoked      BOOLEAN NOT NULL DEFAULT TRUE,
  notify_event        BOOLEAN NOT NULL DEFAULT TRUE,
  notify_emergency    BOOLEAN NOT NULL DEFAULT TRUE,
  sms_sent_today      INTEGER NOT NULL DEFAULT 0,
  sms_last_reset_date DATE DEFAULT CURRENT_DATE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ACCESS ATTEMPTS & RATE LIMITS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.access_attempts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_used   TEXT,
  result       TEXT NOT NULL,
  guard_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  pass_id      UUID REFERENCES public.guest_passes(id) ON DELETE SET NULL,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_attempts_guard_id   ON public.access_attempts(guard_id);
CREATE INDEX IF NOT EXISTS idx_access_attempts_pass_id    ON public.access_attempts(pass_id);
CREATE INDEX IF NOT EXISTS idx_access_attempts_created_at ON public.access_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_access_attempts_result     ON public.access_attempts(result);

CREATE TABLE IF NOT EXISTS public.guard_rate_limits (
  guard_id      UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until  TIMESTAMPTZ
);

-- ── AUDIT LOG ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role  TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id    ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action      ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON public.audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON public.audit_log(created_at);

-- ── RECURRING VISITORS & SCHEDULES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recurring_visitors (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_id      TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  photo_url     TEXT,
  phone         TEXT,
  role          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','blacklisted')),
  valid_until   DATE,
  added_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_id   UUID REFERENCES public.buildings(id) ON DELETE SET NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rv_short_id  ON public.recurring_visitors(short_id);
CREATE INDEX IF NOT EXISTS idx_rv_status    ON public.recurring_visitors(status);
CREATE INDEX IF NOT EXISTS idx_rv_added_by  ON public.recurring_visitors(added_by);

DROP TRIGGER IF EXISTS rv_updated_at ON public.recurring_visitors;
CREATE TRIGGER rv_updated_at
  BEFORE UPDATE ON public.recurring_visitors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.recurring_visitor_apartments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id      UUID NOT NULL REFERENCES public.recurring_visitors(id) ON DELETE CASCADE,
  apartment       TEXT NOT NULL,
  resident_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  schedule        JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  approved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visitor_id, apartment)
);

CREATE INDEX IF NOT EXISTS idx_rva_visitor_id  ON public.recurring_visitor_apartments(visitor_id);
CREATE INDEX IF NOT EXISTS idx_rva_resident_id ON public.recurring_visitor_apartments(resident_id);

-- ── VISIT REQUESTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visit_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                TEXT NOT NULL CHECK (type IN ('delivery','walk_in','emergency')),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','completed','leave_at_gate')),
  visitor_name        TEXT NOT NULL,
  visitor_phone       TEXT,
  destination_apt     TEXT NOT NULL,
  resident_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guard_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  purpose             TEXT,
  notes               TEXT,
  platform            TEXT,
  emergency_type      TEXT,
  responded_at        TIMESTAMPTZ,
  responded_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  access_window_min   INTEGER NOT NULL DEFAULT 20,
  expires_at          TIMESTAMPTZ,
  entry_allowed_until TIMESTAMPTZ,
  auto_approved       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vr_resident_id ON public.visit_requests(resident_id);
CREATE INDEX IF NOT EXISTS idx_vr_guard_id    ON public.visit_requests(guard_id);
CREATE INDEX IF NOT EXISTS idx_vr_status      ON public.visit_requests(status);

DROP TRIGGER IF EXISTS vr_updated_at ON public.visit_requests;
CREATE TRIGGER vr_updated_at
  BEFORE UPDATE ON public.visit_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.entry_logs DROP CONSTRAINT IF EXISTS fk_entry_logs_visit_request;
ALTER TABLE public.entry_logs
  ADD CONSTRAINT fk_entry_logs_visit_request
  FOREIGN KEY (visit_request_id) REFERENCES public.visit_requests(id) ON DELETE SET NULL;

ALTER TABLE public.entry_logs DROP CONSTRAINT IF EXISTS fk_entry_logs_recurring_visitor;
ALTER TABLE public.entry_logs
  ADD CONSTRAINT fk_entry_logs_recurring_visitor
  FOREIGN KEY (recurring_visitor_id) REFERENCES public.recurring_visitors(id) ON DELETE SET NULL;

-- ── EVENTS & EVENT GUESTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  event_type        TEXT NOT NULL CHECK (event_type IN ('wedding','birthday','puja','eid_gathering','corporate','other')),
  apartment         TEXT NOT NULL,
  event_date        DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  expected_count    INTEGER NOT NULL DEFAULT 10,
  max_capacity      INTEGER NOT NULL DEFAULT 50,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status   TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected','not_required')),
  approved_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  counter_token     UUID UNIQUE DEFAULT uuid_generate_v4(),
  counter_admitted  INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed','cancelled')),
  notes             TEXT,
  building_id       UUID REFERENCES public.buildings(id) ON DELETE SET NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_resident_id ON public.events(resident_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date  ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status      ON public.events(status);

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.event_guests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  qr_token    UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  gate_code   TEXT,
  status      TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','arrived','no_show')),
  arrived_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eg_event_id  ON public.event_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_eg_qr_token  ON public.event_guests(qr_token);
CREATE INDEX IF NOT EXISTS idx_eg_gate_code ON public.event_guests(gate_code);

CREATE TABLE IF NOT EXISTS public.event_coordinators (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_ec_event_id ON public.event_coordinators(event_id);

-- ── BLACKLIST ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blacklist (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  phone       TEXT,
  photo_url   TEXT,
  reason      TEXT NOT NULL,
  scope       TEXT NOT NULL DEFAULT 'building' CHECK (scope IN ('building','apartment')),
  added_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  apartment   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blacklist_name   ON public.blacklist(name);
CREATE INDEX IF NOT EXISTS idx_blacklist_phone  ON public.blacklist(phone);
CREATE INDEX IF NOT EXISTS idx_blacklist_active ON public.blacklist(is_active);

DROP TRIGGER IF EXISTS blacklist_updated_at ON public.blacklist;
CREATE TRIGGER blacklist_updated_at
  BEFORE UPDATE ON public.blacklist
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── GUARD SHIFTS & FAMILY MEMBERS & COMPANIONS ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.guard_shifts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_id   UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
  gate          TEXT NOT NULL DEFAULT 'Main',
  shift         TEXT NOT NULL DEFAULT 'day' CHECK (shift IN ('morning','day','evening','night')),
  shift_start   TIME,
  shift_end     TIME,
  active_from   DATE NOT NULL DEFAULT CURRENT_DATE,
  active_until  DATE,
  is_current    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.family_members (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  primary_resident_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name           TEXT NOT NULL,
  relation            TEXT NOT NULL,
  member_type         TEXT NOT NULL DEFAULT 'family' CHECK (member_type IN ('owner','tenant','family')),
  phone               TEXT,
  can_create_passes   BOOLEAN NOT NULL DEFAULT TRUE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  building_id         UUID REFERENCES public.buildings(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.guest_pass_members (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_pass_id  UUID NOT NULL REFERENCES public.guest_passes(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  relation       TEXT NOT NULL,
  is_minor       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_pass_members_pass_id ON public.guest_pass_members(guest_pass_id);

-- ============================================================================
-- 3. DATA BACKFILL & WORKAROUND REMOVAL
-- ============================================================================

-- Backfill guest_passes where purpose is stored as serialized JSON
DO $$
DECLARE
  r RECORD;
  j JSONB;
BEGIN
  FOR r IN SELECT id, purpose FROM public.guest_passes WHERE purpose LIKE '{%' LOOP
    BEGIN
      j := r.purpose::jsonb;
      UPDATE public.guest_passes
      SET
        purpose          = COALESCE(NULLIF(j->>'text', ''), purpose),
        gate_code        = COALESCE(gate_code, j->>'gate_code'),
        allowed_persons  = COALESCE((j->>'allowed_persons')::integer, allowed_persons, 1),
        valid_from       = COALESCE((j->>'valid_from')::timestamptz, valid_from),
        guest_photo_url  = COALESCE(guest_photo_url, j->>'guest_photo_url'),
        guest_photo_path = COALESCE(guest_photo_path, j->>'guest_photo_url')
      WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      -- If JSON parse fails, retain original purpose text
    END;
  END LOOP;
END $$;

-- Align companion members from any legacy JSON payload if present
DO $$
DECLARE
  r RECORD;
  j JSONB;
  c JSONB;
BEGIN
  FOR r IN SELECT id, purpose FROM public.guest_passes WHERE purpose LIKE '%"companions":%' LOOP
    BEGIN
      j := r.purpose::jsonb;
      IF j ? 'companions' AND jsonb_typeof(j->'companions') = 'array' THEN
        FOR c IN SELECT * FROM jsonb_array_elements(j->'companions') LOOP
          INSERT INTO public.guest_pass_members (guest_pass_id, full_name, relation, is_minor)
          VALUES (
            r.id,
            COALESCE(c->>'fullName', 'Guest Companion'),
            COALESCE(c->>'relation', 'Companion'),
            COALESCE((c->>'isMinor')::boolean, FALSE)
          );
        END LOOP;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ignore
    END;
  END LOOP;
END $$;

-- Sync reciprocal columns in entry_logs
UPDATE public.entry_logs
SET
  guard_id          = COALESCE(guard_id, security_guard_id),
  security_guard_id = COALESCE(security_guard_id, guard_id),
  entry_photo_path  = COALESCE(entry_photo_path, entry_photo_url),
  entry_photo_url   = COALESCE(entry_photo_url, entry_photo_path),
  identity_id_type  = COALESCE(identity_id_type, id_type),
  id_type           = COALESCE(id_type, identity_id_type);

-- Backfill expected_exit_at = entry_time + pass duration
UPDATE public.entry_logs el
SET expected_exit_at = el.entry_time + (COALESCE(gp.duration_hours, 24) || ' hours')::interval
FROM public.guest_passes gp
WHERE el.guest_pass_id = gp.id
  AND el.expected_exit_at IS NULL;

-- Mark legacy entries whose stay exceeds pass duration + 24h as checkout_type='auto_closed'
UPDATE public.entry_logs el
SET checkout_type = 'auto_closed'
FROM public.guest_passes gp
WHERE el.guest_pass_id = gp.id
  AND (
    (el.exit_time IS NOT NULL AND el.exit_time > el.entry_time + (COALESCE(gp.duration_hours, 24) || ' hours')::interval + interval '24 hours')
    OR
    (el.exit_time IS NULL AND NOW() > el.entry_time + (COALESCE(gp.duration_hours, 24) || ' hours')::interval + interval '24 hours')
  )
  AND (el.checkout_type IS NULL OR el.checkout_type = 'manual');

-- ============================================================================
-- 4. DB-LEVEL VALIDATION & INTEGRITY CONSTRAINTS
-- ============================================================================

-- Clean legacy phone data before adding regex constraints
UPDATE public.profiles
SET phone_number = NULL
WHERE phone_number IN ('null', 'NULL', '') OR TRIM(phone_number) = '';

UPDATE public.profiles
SET phone_number = '+88' || phone_number
WHERE phone_number ~ '^01[3-9][0-9]{8}$';

UPDATE public.profiles
SET phone_number = NULL
WHERE phone_number IS NOT NULL AND phone_number !~ '^\+8801[3-9][0-9]{8}$';

UPDATE public.guest_passes
SET guest_phone = NULL
WHERE guest_phone IN ('null', 'NULL', '') OR TRIM(guest_phone) = '';

UPDATE public.guest_passes
SET guest_phone = '+88' || guest_phone
WHERE guest_phone ~ '^01[3-9][0-9]{8}$';

UPDATE public.guest_passes
SET guest_phone = NULL
WHERE guest_phone IS NOT NULL AND guest_phone !~ '^\+8801[3-9][0-9]{8}$';

-- Clean valid_from in guest_passes if greater than expiry_time
UPDATE public.guest_passes
SET valid_from = expiry_time - (duration_hours || ' hours')::interval
WHERE valid_from IS NOT NULL AND valid_from >= expiry_time;

-- Clean entered_count vs allowed_persons
UPDATE public.guest_passes
SET allowed_persons = 1
WHERE allowed_persons IS NULL OR allowed_persons < 1;

UPDATE public.guest_passes
SET allowed_persons = 10
WHERE allowed_persons > 10;

UPDATE public.guest_passes
SET entered_count = allowed_persons
WHERE entered_count > allowed_persons;

-- Clean entry_logs exit_time < entry_time
UPDATE public.entry_logs
SET exit_time = entry_time
WHERE exit_time IS NOT NULL AND exit_time < entry_time;

-- Apply Constraints
ALTER TABLE public.guest_passes DROP CONSTRAINT IF EXISTS chk_guest_passes_allowed_persons;
ALTER TABLE public.guest_passes
  ADD CONSTRAINT chk_guest_passes_allowed_persons
  CHECK (allowed_persons BETWEEN 1 AND 10);

ALTER TABLE public.guest_passes DROP CONSTRAINT IF EXISTS chk_guest_passes_entered_count;
ALTER TABLE public.guest_passes
  ADD CONSTRAINT chk_guest_passes_entered_count
  CHECK (entered_count BETWEEN 0 AND allowed_persons);

ALTER TABLE public.guest_passes DROP CONSTRAINT IF EXISTS chk_guest_passes_valid_window;
ALTER TABLE public.guest_passes
  ADD CONSTRAINT chk_guest_passes_valid_window
  CHECK (valid_from IS NULL OR expiry_time > valid_from);

ALTER TABLE public.guest_passes DROP CONSTRAINT IF EXISTS chk_guest_passes_phone;
ALTER TABLE public.guest_passes
  ADD CONSTRAINT chk_guest_passes_phone
  CHECK (guest_phone IS NULL OR guest_phone ~ '^\+8801[3-9][0-9]{8}$');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_profiles_phone;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_phone
  CHECK (phone_number IS NULL OR phone_number ~ '^\+8801[3-9][0-9]{8}$');

ALTER TABLE public.entry_logs DROP CONSTRAINT IF EXISTS chk_entry_logs_exit_after_entry;
ALTER TABLE public.entry_logs
  ADD CONSTRAINT chk_entry_logs_exit_after_entry
  CHECK (exit_time IS NULL OR exit_time >= entry_time);

ALTER TABLE public.recurring_visitors DROP CONSTRAINT IF EXISTS chk_recurring_visitors_phone;
ALTER TABLE public.recurring_visitors
  ADD CONSTRAINT chk_recurring_visitors_phone
  CHECK (phone IS NULL OR phone ~ '^\+8801[3-9][0-9]{8}$');

-- Unique Gate Code (only for active passes)
DROP INDEX IF EXISTS public.idx_guest_passes_gate_code_unique;
CREATE UNIQUE INDEX idx_guest_passes_gate_code_unique
  ON public.guest_passes (gate_code)
  WHERE gate_code IS NOT NULL AND status = 'valid' AND archived_at IS NULL;

-- Unique QR Token on event_guests
DROP INDEX IF EXISTS public.idx_event_guests_qr_token_unique;
CREATE UNIQUE INDEX idx_event_guests_qr_token_unique
  ON public.event_guests (qr_token);

-- ============================================================================
-- 5. IMMUTABILITY TRIGGERS (AUDIT TRAIL & TAMPER PROTECTION)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.block_evidence_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deleting records from % is strictly forbidden for security audit compliance', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.block_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log rows are immutable: UPDATE and DELETE operations are forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_mutation ON public.audit_log;
CREATE TRIGGER audit_log_no_mutation
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutation();

DROP TRIGGER IF EXISTS entry_logs_no_delete ON public.entry_logs;
CREATE TRIGGER entry_logs_no_delete
  BEFORE DELETE ON public.entry_logs
  FOR EACH ROW EXECUTE FUNCTION public.block_evidence_deletion();

DROP TRIGGER IF EXISTS guest_passes_no_delete ON public.guest_passes;
CREATE TRIGGER guest_passes_no_delete
  BEFORE DELETE ON public.guest_passes
  FOR EACH ROW EXECUTE FUNCTION public.block_evidence_deletion();

-- ============================================================================
-- 6. RPC FUNCTIONS
-- ============================================================================

-- Fast token / gate-code verification RPC
CREATE OR REPLACE FUNCTION public.verify_guest_token(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_pass RECORD;
  v_res  RECORD;
  v_entry RECORD;
  v_is_gate_code BOOLEAN;
BEGIN
  v_is_gate_code := (p_token ~ '^\d{6}$');

  IF v_is_gate_code THEN
    SELECT * INTO v_pass FROM public.guest_passes
    WHERE gate_code = p_token AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  ELSE
    BEGIN
      SELECT * INTO v_pass FROM public.guest_passes
      WHERE qr_token = p_token::uuid AND archived_at IS NULL;
    EXCEPTION WHEN OTHERS THEN
      SELECT * INTO v_pass FROM public.guest_passes
      WHERE qr_token::text = p_token AND archived_at IS NULL;
    END;
  END IF;

  IF NOT FOUND OR v_pass.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found', 'message', 'Pass not found or inactive');
  END IF;

  SELECT id, full_name, email, apartment_number, phone_number INTO v_res
  FROM public.profiles WHERE id = v_pass.resident_id;

  IF v_pass.status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'revoked', 'message', 'Pass has been revoked by resident');
  END IF;

  IF v_pass.status = 'used' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'used', 'message', 'Single-use pass has already been used');
  END IF;

  IF v_pass.valid_from IS NOT NULL AND NOW() < v_pass.valid_from THEN
    RETURN jsonb_build_object(
      'valid', false, 'status', 'too_early',
      'message', 'Pass is not valid yet',
      'valid_from', v_pass.valid_from
    );
  END IF;

  IF NOW() > v_pass.expiry_time THEN
    RETURN jsonb_build_object('valid', false, 'status', 'expired', 'message', 'Pass expired on ' || v_pass.expiry_time::text);
  END IF;

  SELECT * INTO v_entry FROM public.entry_logs
  WHERE guest_pass_id = v_pass.id AND status IN ('inside', 'overstay')
  ORDER BY entry_time DESC LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'valid', false, 'status', 'already_inside',
      'message', 'Visitor is currently inside building',
      'guest_pass', row_to_json(v_pass),
      'resident', row_to_json(v_res),
      'entry_log_id', v_entry.id,
      'entry_time', v_entry.entry_time
    );
  END IF;

  IF v_pass.entered_count >= v_pass.allowed_persons THEN
    RETURN jsonb_build_object(
      'valid', false, 'status', 'limit_exceeded',
      'message', 'Maximum headcount limit reached (' || v_pass.allowed_persons || ' persons)'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'valid',
    'message', 'Pass is valid',
    'guest_pass', row_to_json(v_pass),
    'resident', row_to_json(v_res),
    'persons_remaining', v_pass.allowed_persons - v_pass.entered_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expiry function for passes
CREATE OR REPLACE FUNCTION public.expire_guest_passes()
RETURNS void AS $$
BEGIN
  UPDATE public.guest_passes
  SET status = 'expired'
  WHERE status = 'valid'
    AND expiry_time < NOW()
    AND archived_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expiry function for visit requests
CREATE OR REPLACE FUNCTION public.expire_visit_requests()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.visit_requests
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recurring visitor short-ID generator
CREATE OR REPLACE FUNCTION public.generate_rv_short_id()
RETURNS TEXT AS $$
DECLARE
  v_candidate TEXT;
  v_exists    BOOLEAN;
BEGIN
  LOOP
    v_candidate := 'RV-' || LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0');
    SELECT EXISTS (SELECT 1 FROM public.recurring_visitors WHERE short_id = v_candidate) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_candidate;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Overstay detection & penalty calculation
CREATE OR REPLACE FUNCTION public.detect_overstays_full()
RETURNS JSONB AS $$
DECLARE
  v_policy       RECORD;
  v_overstayed   INTEGER := 0;
  v_penalties    INTEGER := 0;
  v_grace_min    INTEGER;
  v_rate_bdt     NUMERIC(10,2);
  v_now          TIMESTAMPTZ := NOW();
  rec            RECORD;
  v_expected     TIMESTAMPTZ;
  v_min_over     INTEGER;
  v_amt          NUMERIC(10,2);
  v_month_year   TEXT := TO_CHAR(NOW(), 'YYYY-MM');
BEGIN
  SELECT * INTO v_policy FROM public.policy_settings LIMIT 1;
  v_grace_min := COALESCE(v_policy.overstay_grace_minutes, 15);
  v_rate_bdt  := COALESCE(v_policy.overstay_penalty_rate_bdt, 50.00);

  UPDATE public.entry_logs el
  SET
    status = 'overstay',
    overstay_started_at = COALESCE(el.overstay_started_at, el.expected_exit_at + (v_grace_min || ' minutes')::interval)
  FROM public.guest_passes gp
  WHERE el.guest_pass_id = gp.id
    AND el.status = 'inside'
    AND el.expected_exit_at IS NOT NULL
    AND v_now > (el.expected_exit_at + (v_grace_min || ' minutes')::interval);
  GET DIAGNOSTICS v_overstayed = ROW_COUNT;

  IF COALESCE(v_policy.penalty_enabled, TRUE) THEN
    FOR rec IN
      SELECT
        el.id AS entry_log_id,
        el.guest_pass_id,
        el.expected_exit_at,
        el.overstay_started_at,
        gp.resident_id
      FROM public.entry_logs el
      JOIN public.guest_passes gp ON el.guest_pass_id = gp.id
      WHERE el.status = 'overstay'
        AND NOT EXISTS (
          SELECT 1 FROM public.penalties p WHERE p.entry_log_id = el.id
        )
    LOOP
      v_expected := rec.expected_exit_at + (v_grace_min || ' minutes')::interval;
      v_min_over := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_expected))::INTEGER / 60);
      v_amt      := ROUND((v_min_over / 60.0) * v_rate_bdt, 2);

      INSERT INTO public.penalties (
        resident_id, entry_log_id, pass_id,
        minutes_over, amount_bdt, status, month_year
      ) VALUES (
        rec.resident_id, rec.entry_log_id, rec.guest_pass_id,
        v_min_over, v_amt, 'pending', v_month_year
      );
      v_penalties := v_penalties + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'overstays_detected', v_overstayed,
    'penalties_created', v_penalties
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pass_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_visitor_apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_pass_members ENABLE ROW LEVEL SECURITY;

-- ── PROFILES POLICIES ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_elevated" ON public.profiles;
CREATE POLICY "profiles_select_elevated" ON public.profiles
  FOR SELECT USING (public.get_my_role() IN ('admin', 'security'));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.get_my_role() = 'admin');

-- ── BUILDINGS POLICIES ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "buildings_select_auth" ON public.buildings;
CREATE POLICY "buildings_select_auth" ON public.buildings
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "buildings_admin_manage" ON public.buildings;
CREATE POLICY "buildings_admin_manage" ON public.buildings
  FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- ── APARTMENTS POLICIES ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "apartments_select_auth" ON public.apartments;
CREATE POLICY "apartments_select_auth" ON public.apartments
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "apartments_admin_manage" ON public.apartments;
CREATE POLICY "apartments_admin_manage" ON public.apartments
  FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- ── GUEST PASSES POLICIES ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "guest_passes_select_resident" ON public.guest_passes;
CREATE POLICY "guest_passes_select_resident" ON public.guest_passes
  FOR SELECT USING (resident_id = auth.uid());

DROP POLICY IF EXISTS "guest_passes_select_security_admin" ON public.guest_passes;
CREATE POLICY "guest_passes_select_security_admin" ON public.guest_passes
  FOR SELECT USING (public.get_my_role() IN ('security', 'admin'));

DROP POLICY IF EXISTS "guest_passes_insert_resident" ON public.guest_passes;
CREATE POLICY "guest_passes_insert_resident" ON public.guest_passes
  FOR INSERT WITH CHECK (resident_id = auth.uid() AND public.get_my_role() = 'resident');

DROP POLICY IF EXISTS "guest_passes_update_resident" ON public.guest_passes;
CREATE POLICY "guest_passes_update_resident" ON public.guest_passes
  FOR UPDATE USING (resident_id = auth.uid()) WITH CHECK (resident_id = auth.uid());

DROP POLICY IF EXISTS "guest_passes_update_elevated" ON public.guest_passes;
CREATE POLICY "guest_passes_update_elevated" ON public.guest_passes
  FOR UPDATE USING (public.get_my_role() IN ('security', 'admin'));

-- ── ENTRY LOGS POLICIES ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "entry_logs_select_security_admin" ON public.entry_logs;
CREATE POLICY "entry_logs_select_security_admin" ON public.entry_logs
  FOR SELECT USING (public.get_my_role() IN ('security', 'admin'));

DROP POLICY IF EXISTS "entry_logs_select_resident" ON public.entry_logs;
CREATE POLICY "entry_logs_select_resident" ON public.entry_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.guest_passes gp
      WHERE gp.id = guest_pass_id AND gp.resident_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "entry_logs_insert_security_admin" ON public.entry_logs;
CREATE POLICY "entry_logs_insert_security_admin" ON public.entry_logs
  FOR INSERT WITH CHECK (public.get_my_role() IN ('security', 'admin'));

DROP POLICY IF EXISTS "entry_logs_update_security_admin" ON public.entry_logs;
CREATE POLICY "entry_logs_update_security_admin" ON public.entry_logs
  FOR UPDATE USING (public.get_my_role() IN ('security', 'admin'));

-- ── PASS EXTENSIONS POLICIES ────────────────────────────────────────────────
DROP POLICY IF EXISTS "pe_select_resident" ON public.pass_extensions;
CREATE POLICY "pe_select_resident" ON public.pass_extensions
  FOR SELECT USING (
    requested_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.guest_passes gp WHERE gp.id = pass_id AND gp.resident_id = auth.uid())
  );

DROP POLICY IF EXISTS "pe_select_elevated" ON public.pass_extensions;
CREATE POLICY "pe_select_elevated" ON public.pass_extensions
  FOR SELECT USING (public.get_my_role() IN ('security', 'admin'));

DROP POLICY IF EXISTS "pe_insert_resident" ON public.pass_extensions;
CREATE POLICY "pe_insert_resident" ON public.pass_extensions
  FOR INSERT WITH CHECK (
    requested_by = auth.uid() AND
    EXISTS (SELECT 1 FROM public.guest_passes gp WHERE gp.id = pass_id AND gp.resident_id = auth.uid())
  );

DROP POLICY IF EXISTS "pe_update_admin" ON public.pass_extensions;
CREATE POLICY "pe_update_admin" ON public.pass_extensions
  FOR UPDATE USING (public.get_my_role() = 'admin' OR approved_by = auth.uid());

-- ── PENALTIES POLICIES ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "penalties_select_resident" ON public.penalties;
CREATE POLICY "penalties_select_resident" ON public.penalties
  FOR SELECT USING (resident_id = auth.uid());

DROP POLICY IF EXISTS "penalties_select_elevated" ON public.penalties;
CREATE POLICY "penalties_select_elevated" ON public.penalties
  FOR SELECT USING (public.get_my_role() IN ('admin', 'security'));

DROP POLICY IF EXISTS "penalties_update_admin" ON public.penalties;
CREATE POLICY "penalties_update_admin" ON public.penalties
  FOR UPDATE USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "penalties_insert_service" ON public.penalties;
CREATE POLICY "penalties_insert_service" ON public.penalties
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── POLICY SETTINGS POLICIES ────────────────────────────────────────────────
DROP POLICY IF EXISTS "policy_select_auth" ON public.policy_settings;
CREATE POLICY "policy_select_auth" ON public.policy_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "policy_update_admin" ON public.policy_settings;
CREATE POLICY "policy_update_admin" ON public.policy_settings
  FOR UPDATE USING (public.get_my_role() = 'admin');

-- ── NOTIFICATIONS POLICIES ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_auth" ON public.notifications;
CREATE POLICY "notifications_insert_auth" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notif_pref_own" ON public.notification_preferences;
CREATE POLICY "notif_pref_own" ON public.notification_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── ACCESS ATTEMPTS & RATE LIMITS POLICIES ──────────────────────────────────
DROP POLICY IF EXISTS "access_attempts_select_elevated" ON public.access_attempts;
CREATE POLICY "access_attempts_select_elevated" ON public.access_attempts
  FOR SELECT USING (public.get_my_role() IN ('security', 'admin'));

DROP POLICY IF EXISTS "access_attempts_insert_auth" ON public.access_attempts;
CREATE POLICY "access_attempts_insert_auth" ON public.access_attempts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "guard_rate_limits_own" ON public.guard_rate_limits;
CREATE POLICY "guard_rate_limits_own" ON public.guard_rate_limits
  FOR ALL USING (guard_id = auth.uid()) WITH CHECK (guard_id = auth.uid());

-- ── AUDIT LOG POLICIES ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_log_select_admin" ON public.audit_log;
CREATE POLICY "audit_log_select_admin" ON public.audit_log
  FOR SELECT USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "audit_log_insert_auth" ON public.audit_log;
CREATE POLICY "audit_log_insert_auth" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── RECURRING VISITORS POLICIES ─────────────────────────────────────────────
DROP POLICY IF EXISTS "rv_select_all_auth" ON public.recurring_visitors;
CREATE POLICY "rv_select_all_auth" ON public.recurring_visitors
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "rv_insert_resident_admin" ON public.recurring_visitors;
CREATE POLICY "rv_insert_resident_admin" ON public.recurring_visitors
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "rv_update_resident_admin" ON public.recurring_visitors;
CREATE POLICY "rv_update_resident_admin" ON public.recurring_visitors
  FOR UPDATE USING (added_by = auth.uid() OR public.get_my_role() IN ('admin', 'security'));

DROP POLICY IF EXISTS "rva_all_auth" ON public.recurring_visitor_apartments;
CREATE POLICY "rva_all_auth" ON public.recurring_visitor_apartments
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── VISIT REQUESTS POLICIES ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "vr_select_involved" ON public.visit_requests;
CREATE POLICY "vr_select_involved" ON public.visit_requests
  FOR SELECT USING (resident_id = auth.uid() OR public.get_my_role() IN ('security', 'admin'));

DROP POLICY IF EXISTS "vr_insert_guard_resident" ON public.visit_requests;
CREATE POLICY "vr_insert_guard_resident" ON public.visit_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "vr_update_involved" ON public.visit_requests;
CREATE POLICY "vr_update_involved" ON public.visit_requests
  FOR UPDATE USING (resident_id = auth.uid() OR public.get_my_role() IN ('security', 'admin'));

-- ── EVENTS POLICIES ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_select_all" ON public.events;
CREATE POLICY "events_select_all" ON public.events
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "events_insert_resident" ON public.events;
CREATE POLICY "events_insert_resident" ON public.events
  FOR INSERT WITH CHECK (resident_id = auth.uid());

DROP POLICY IF EXISTS "events_update_involved" ON public.events;
CREATE POLICY "events_update_involved" ON public.events
  FOR UPDATE USING (resident_id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "eg_select_all" ON public.event_guests;
CREATE POLICY "eg_select_all" ON public.event_guests
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "eg_manage_resident_security" ON public.event_guests;
CREATE POLICY "eg_manage_resident_security" ON public.event_guests
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ec_all_auth" ON public.event_coordinators;
CREATE POLICY "ec_all_auth" ON public.event_coordinators
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── BLACKLIST POLICIES ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "blacklist_select_auth" ON public.blacklist;
CREATE POLICY "blacklist_select_auth" ON public.blacklist
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "blacklist_insert_auth" ON public.blacklist;
CREATE POLICY "blacklist_insert_auth" ON public.blacklist
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'resident'));

DROP POLICY IF EXISTS "blacklist_update_admin" ON public.blacklist;
CREATE POLICY "blacklist_update_admin" ON public.blacklist
  FOR UPDATE USING (public.get_my_role() = 'admin' OR added_by = auth.uid());

-- ── SHIFTS, FAMILY & GUEST MEMBERS POLICIES ─────────────────────────────────
DROP POLICY IF EXISTS "gs_select_elevated" ON public.guard_shifts;
CREATE POLICY "gs_select_elevated" ON public.guard_shifts
  FOR SELECT USING (public.get_my_role() IN ('admin', 'security'));

DROP POLICY IF EXISTS "gs_manage_admin" ON public.guard_shifts;
CREATE POLICY "gs_manage_admin" ON public.guard_shifts
  FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "fm_select_own_admin" ON public.family_members;
CREATE POLICY "fm_select_own_admin" ON public.family_members
  FOR SELECT USING (primary_resident_id = auth.uid() OR member_id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "fm_manage_resident" ON public.family_members;
CREATE POLICY "fm_manage_resident" ON public.family_members
  FOR ALL USING (primary_resident_id = auth.uid()) WITH CHECK (primary_resident_id = auth.uid());

DROP POLICY IF EXISTS "gpm_select_auth" ON public.guest_pass_members;
CREATE POLICY "gpm_select_auth" ON public.guest_pass_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "gpm_insert_auth" ON public.guest_pass_members;
CREATE POLICY "gpm_insert_auth" ON public.guest_pass_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 8. SCHEMA CACHE RELOAD NOTIFICATION
-- ============================================================================

NOTIFY pgrst, 'reload schema';
