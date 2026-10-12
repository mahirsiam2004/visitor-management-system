# VMS Known Bugs & Audit Findings (Phase 0 Audit)

| Role | Route | Symptom | Root Cause | Severity |
|---|---|---|---|---|
| Admin | `/dashboard/admin/extensions` | "Could not find the table 'public.pass_extensions' in the schema cache" | Missing table `pass_extensions` in live Supabase DB | Critical |
| Admin | `/dashboard/admin/penalties` | "Could not find the table 'public.penalties' in the schema cache" | Missing table `penalties` in live Supabase DB | Critical |
| Admin | `/dashboard/admin/audit` | "Could not find the table 'public.audit_log' in the schema cache" | Missing table `audit_log` in live Supabase DB | Critical |
| Resident | `/dashboard/resident/penalties` | Fails to load penalty records or shows schema cache error | Missing table `penalties` in live Supabase DB | High |
| All | Pass creation / Entry logs | Extra fields (allowed_persons, gate_code, guest_photo_url, id_type) serialized as JSON inside `purpose` / `notes` | Schema mismatch; missing columns on `guest_passes` & `entry_logs` | High |
| Security | `/dashboard/security/visitors`, `/dashboard/security/logs` | "0 min over" or "1847h" overstay display; missing Check Out button for overstay | Overstay calculation not unified; status logic scattered; no unified `visit-status.ts` | High |
| Admin / Security | `/dashboard/admin/analytics`, `/dashboard/security` | Inside Now & Overstay counts mismatch between guard dashboard and admin analytics | Different calculation filters / timezone mismatch (UTC vs Asia/Dhaka) | Medium |
| All | Forms & Inputs | Foreign phone numbers accepted (+1, 12345678); date inputs using native mm/dd/yyyy | Validation allows arbitrary phone format; missing BD phone normalization (+8801[3-9]XXXXXXXX); native date inputs | High |
| Resident | Registration / Profile | Free-text apartment fields allowing sign-up into any flat; pending approval missing | No validation against `apartments` table; missing `profiles.status = 'pending'` check | High |
| All | File uploads | Photos uploaded to public host `i.ibb.co` | `lib/imgbb.ts` used instead of private Supabase Storage buckets with signed URLs | High |
| Admin | `/dashboard/admin/extensions` | Build error / JSX syntax error `Expected '</', got 'ident'` | Missing closing tag in conditional rendering block (fixed in Phase 0 step 1) | Critical (Resolved) |
| Security | `/dashboard/security/quick-entry/*` | Incomplete quick entry forms & missing live countdown for pending resident approvals | Visit requests missing Realtime subscription and timeout handling | Medium |
