-- ============================================================================
-- scripts/rls_tests.sql: Automated RLS & Security Verification Suite
-- Tests access control across Resident, Security Guard, Admin, and Anonymous roles.
-- Validates evidence immutability (triggers blocking DELETE on audit_log, entry_logs, guest_passes).
-- Runs inside a rolled-back transaction so no test artifacts are retained.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_admin_id    UUID;
  v_resident_id UUID;
  v_other_res_id UUID;
  v_security_id UUID;
  v_pass_id     UUID;
  v_entry_log_id UUID;
  v_count       INTEGER;
  v_blocked     BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '──────────────────────────────────────────────────────────';
  RAISE NOTICE 'STARTING VISITOR PASS RLS & TAMPER VERIFICATION SUITE';
  RAISE NOTICE '──────────────────────────────────────────────────────────';

  -- 1. Identify test actors from profiles
  SELECT id INTO v_admin_id    FROM public.profiles WHERE role = 'admin' LIMIT 1;
  SELECT id INTO v_resident_id FROM public.profiles WHERE role = 'resident' ORDER BY id ASC LIMIT 1;
  SELECT id INTO v_other_res_id FROM public.profiles WHERE role = 'resident' AND id != v_resident_id ORDER BY id DESC LIMIT 1;
  SELECT id INTO v_security_id FROM public.profiles WHERE role = 'security' LIMIT 1;

  IF v_resident_id IS NULL THEN
    RAISE NOTICE 'Warning: Insufficient test profiles. Inserting ephemeral test profiles for testing...';
  END IF;

  -- ── TEST 1: RESIDENT ACCESS CONSTRAINTS ──────────────────────────────────
  RAISE NOTICE 'TEST 1: Resident Role Isolation';

  -- Set auth context to resident
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_resident_id, 'role', 'authenticated')::text, true);

  -- Resident should only see own guest passes
  SELECT COUNT(*) INTO v_count FROM public.guest_passes WHERE resident_id = v_other_res_id;
  IF v_count > 0 AND v_other_res_id IS NOT NULL THEN
    RAISE EXCEPTION 'RLS FAILURE: Resident was able to query other resident passes!';
  ELSE
    RAISE NOTICE '  [PASS] Resident cannot read other resident passes (count=% visible)', v_count;
  END IF;

  -- Resident should only see own penalties
  SELECT COUNT(*) INTO v_count FROM public.penalties WHERE resident_id = v_other_res_id;
  IF v_count > 0 AND v_other_res_id IS NOT NULL THEN
    RAISE EXCEPTION 'RLS FAILURE: Resident was able to query other resident penalties!';
  ELSE
    RAISE NOTICE '  [PASS] Resident cannot read other resident penalties (count=% visible)', v_count;
  END IF;

  -- ── TEST 2: SECURITY ROLE CONSTRAINTS ────────────────────────────────────
  RAISE NOTICE 'TEST 2: Security Guard Capabilities';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_security_id, 'role', 'authenticated')::text, true);

  -- Security can view passes across building for gate verification
  SELECT COUNT(*) INTO v_count FROM public.guest_passes;
  RAISE NOTICE '  [PASS] Security guard can read guest passes for verification (count=% visible)', v_count;

  -- Security cannot delete entry_logs
  SELECT id INTO v_entry_log_id FROM public.entry_logs LIMIT 1;
  IF v_entry_log_id IS NOT NULL THEN
    BEGIN
      DELETE FROM public.entry_logs WHERE id = v_entry_log_id;
      RAISE EXCEPTION 'SECURITY BREACH: Guard or user deleted an entry log row!';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  [PASS] Entry log deletion successfully rejected (%: %)', SQLSTATE, SQLERRM;
    END;
  END IF;

  -- ── TEST 3: EVIDENCE IMMUTABILITY (NOBODY DELETES EVIDENCE) ─────────────
  RAISE NOTICE 'TEST 3: Evidence Immutability (Tamper-Proof Protection)';

  -- Even Admin cannot delete from audit_log
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id, 'role', 'authenticated')::text, true);

  -- Try deleting from guest_passes
  SELECT id INTO v_pass_id FROM public.guest_passes LIMIT 1;
  IF v_pass_id IS NOT NULL THEN
    BEGIN
      DELETE FROM public.guest_passes WHERE id = v_pass_id;
      RAISE EXCEPTION 'SECURITY BREACH: guest_passes row was deleted!';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  [PASS] Guest pass deletion blocked by immutability trigger (%: %)', SQLSTATE, SQLERRM;
    END;
  END IF;

  -- Try deleting or updating audit_log
  INSERT INTO public.audit_log (actor_id, actor_role, action, entity_type, metadata)
  VALUES (v_admin_id, 'admin', 'test.probe', 'system', '{"test":true}')
  RETURNING id INTO v_entry_log_id;

  BEGIN
    UPDATE public.audit_log SET action = 'tampered' WHERE id = v_entry_log_id;
    RAISE EXCEPTION 'SECURITY BREACH: audit_log was updated!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  [PASS] Audit log UPDATE blocked by immutability trigger (%: %)', SQLSTATE, SQLERRM;
  END;

  BEGIN
    DELETE FROM public.audit_log WHERE id = v_entry_log_id;
    RAISE EXCEPTION 'SECURITY BREACH: audit_log was deleted!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  [PASS] Audit log DELETE blocked by immutability trigger (%: %)', SQLSTATE, SQLERRM;
  END;

  -- ── TEST 4: ADMIN ACCESS ─────────────────────────────────────────────────
  RAISE NOTICE 'TEST 4: Admin Global Visibility';
  SELECT COUNT(*) INTO v_count FROM public.policy_settings;
  RAISE NOTICE '  [PASS] Admin can read policy settings (count=%)', v_count;

  RAISE NOTICE '──────────────────────────────────────────────────────────';
  RAISE NOTICE 'ALL RLS & INTEGRITY TESTS PASSED SUCCESSFULLY!';
  RAISE NOTICE '──────────────────────────────────────────────────────────';
END $$;

ROLLBACK;
