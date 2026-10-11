-- ============================================================
-- Migration 009: Multi-building, Guard shifts, Family members
-- All idempotent (IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- ============================================================
-- 1. BUILDINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.buildings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  address       TEXT NOT NULL,
  city          TEXT NOT NULL DEFAULT 'Dhaka',
  country       TEXT NOT NULL DEFAULT 'Bangladesh',
  code          TEXT NOT NULL UNIQUE,  -- short code e.g. 'BLK-A', 'TOWER-1'
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed a default building so existing data doesn't break
INSERT INTO public.buildings (id, name, address, code)
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    'SecureEntry Main',
    'Dhaka, Bangladesh',
    'MAIN'
  )
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "buildings_select_auth"  ON public.buildings FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY IF NOT EXISTS "buildings_insert_admin" ON public.buildings FOR INSERT  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY IF NOT EXISTS "buildings_update_admin" ON public.buildings FOR UPDATE  USING (public.get_my_role() = 'admin');

-- ============================================================
-- 2. ADD building_id TO ALL RELEVANT TABLES
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS building_id UUID
    REFERENCES public.buildings(id) ON DELETE SET NULL
    DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.guest_passes
  ADD COLUMN IF NOT EXISTS building_id UUID
    REFERENCES public.buildings(id) ON DELETE CASCADE
    DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.entry_logs
  ADD COLUMN IF NOT EXISTS building_id UUID
    REFERENCES public.buildings(id) ON DELETE CASCADE
    DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS building_id UUID
    REFERENCES public.buildings(id) ON DELETE CASCADE
    DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.recurring_visitors
  ADD COLUMN IF NOT EXISTS building_id UUID
    REFERENCES public.buildings(id) ON DELETE CASCADE
    DEFAULT '00000000-0000-0000-0000-000000000001';

-- Backfill all existing rows
UPDATE public.profiles         SET building_id = '00000000-0000-0000-0000-000000000001' WHERE building_id IS NULL;
UPDATE public.guest_passes     SET building_id = '00000000-0000-0000-0000-000000000001' WHERE building_id IS NULL;
UPDATE public.entry_logs       SET building_id = '00000000-0000-0000-0000-000000000001' WHERE building_id IS NULL;
UPDATE public.events           SET building_id = '00000000-0000-0000-0000-000000000001' WHERE building_id IS NULL;
UPDATE public.recurring_visitors SET building_id = '00000000-0000-0000-0000-000000000001' WHERE building_id IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_building     ON public.profiles(building_id);
CREATE INDEX IF NOT EXISTS idx_guest_passes_building ON public.guest_passes(building_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_building   ON public.entry_logs(building_id);

-- ============================================================
-- 3. GATE + SHIFT ON ENTRY LOGS
-- ============================================================
ALTER TABLE public.entry_logs
  ADD COLUMN IF NOT EXISTS gate   TEXT,   -- 'Gate 1', 'Gate 2', 'Main', etc.
  ADD COLUMN IF NOT EXISTS shift  TEXT    -- 'day', 'night', 'morning'
    CHECK (shift IN ('morning','day','evening','night') OR shift IS NULL);

-- ============================================================
-- 4. GUARD_SHIFTS — assignment of guards to gate+shift
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guard_shifts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  gate        TEXT NOT NULL DEFAULT 'Main',
  shift       TEXT NOT NULL DEFAULT 'day'
    CHECK (shift IN ('morning','day','evening','night')),
  shift_start TIME,
  shift_end   TIME,
  active_from DATE NOT NULL DEFAULT CURRENT_DATE,
  active_until DATE,
  is_current  BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guard_shifts_guard    ON public.guard_shifts(guard_id);
CREATE INDEX IF NOT EXISTS idx_guard_shifts_building ON public.guard_shifts(building_id);
CREATE INDEX IF NOT EXISTS idx_guard_shifts_current  ON public.guard_shifts(is_current);

ALTER TABLE public.guard_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "gs_select_elevated" ON public.guard_shifts FOR SELECT USING (public.get_my_role() IN ('admin','security'));
CREATE POLICY IF NOT EXISTS "gs_insert_admin"    ON public.guard_shifts FOR INSERT WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY IF NOT EXISTS "gs_update_admin"    ON public.guard_shifts FOR UPDATE USING (public.get_my_role() = 'admin');

-- ============================================================
-- 5. FAMILY_MEMBERS TABLE
-- ============================================================
-- Apartment-level sub-accounts under the primary resident
CREATE TABLE IF NOT EXISTS public.family_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  primary_resident_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- if they have a profile
  full_name       TEXT NOT NULL,
  relation        TEXT NOT NULL,  -- owner, tenant, spouse, child, parent, other
  member_type     TEXT NOT NULL DEFAULT 'family'
    CHECK (member_type IN ('owner','tenant','family')),
  phone           TEXT,
  can_create_passes BOOLEAN NOT NULL DEFAULT TRUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  building_id     UUID REFERENCES public.buildings(id) ON DELETE CASCADE
    DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fm_primary        ON public.family_members(primary_resident_id);
CREATE INDEX IF NOT EXISTS idx_fm_member         ON public.family_members(member_id);
CREATE INDEX IF NOT EXISTS idx_fm_building       ON public.family_members(building_id);

CREATE TRIGGER fm_updated_at
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Primary resident sees/manages their own family
CREATE POLICY IF NOT EXISTS "fm_select_own"    ON public.family_members FOR SELECT  USING (primary_resident_id = auth.uid() OR member_id = auth.uid());
CREATE POLICY IF NOT EXISTS "fm_select_admin"  ON public.family_members FOR SELECT  USING (public.get_my_role() = 'admin');
CREATE POLICY IF NOT EXISTS "fm_insert_own"    ON public.family_members FOR INSERT  WITH CHECK (primary_resident_id = auth.uid());
CREATE POLICY IF NOT EXISTS "fm_update_own"    ON public.family_members FOR UPDATE  USING (primary_resident_id = auth.uid() OR public.get_my_role() = 'admin');

-- ============================================================
-- 6. USER CONSENT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_consents (
  user_id         UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data_collection BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_version TEXT NOT NULL DEFAULT '1.0',
  consented_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      TEXT
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "consent_own"    ON public.user_consents FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "consent_admin"  ON public.user_consents FOR SELECT USING (public.get_my_role() = 'admin');

-- ============================================================
-- 7. get_my_building() helper (used in RLS for multi-tenant)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_building()
RETURNS UUID AS $$
  SELECT building_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 8. PHOTO RETENTION: scheduled soft-delete of old entry photos
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_old_photos(p_retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.entry_logs
  SET entry_photo_url = NULL
  WHERE entry_photo_url IS NOT NULL
    AND entry_time < NOW() - (p_retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- pg_cron: daily photo cleanup
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('expire-old-photos','0 3 * * *','SELECT public.expire_old_photos(90)');
  END IF;
END $$;
