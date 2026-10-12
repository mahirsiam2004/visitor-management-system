# Database Schema Gap Analysis (Live Supabase DB vs Application Code)

## Summary
- **Live Supabase DB State**: Only 3 tables exist (`profiles`, `guest_passes`, `entry_logs`). All other 20 tables are completely missing. Zero storage buckets exist.
- **Code Expectations**: Requires 23 tables, extended columns on all 3 existing tables, immutable audit & evidence triggers, security-definer helper functions, and 3 private storage buckets (`guest-photos`, `staff-photos`, `entry-photos`).

---

## 1. Existing Tables: Column Differences

### `profiles`
| In Live DB / Initial Script | Added by Code | Gap Status |
| :--- | :--- | :--- |
| `id` (UUID PK), `email` (TEXT), `full_name` (TEXT), `phone_number` (TEXT), `apartment_number` (TEXT), `role` (TEXT), `avatar_url` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ) | `is_active` (BOOLEAN DEFAULT TRUE)<br>`deactivated_at` (TIMESTAMPTZ)<br>`deactivated_by` (UUID)<br>`deactivation_reason` (TEXT)<br>`delivery_auto_allow_until` (TIMESTAMPTZ)<br>`building_id` (UUID) | **Missing 6 columns** in live DB |

### `guest_passes`
| In Live DB / Initial Script | Added by Code | Gap Status |
| :--- | :--- | :--- |
| `id` (UUID PK), `guest_id` (TEXT), `guest_name` (TEXT), `guest_phone` (TEXT), `resident_id` (UUID), `apartment_number` (TEXT), `visit_date` (DATE), `visit_time` (TIME), `expiry_time` (TIMESTAMPTZ), `duration_hours` (INTEGER), `purpose` (TEXT), `qr_token` (UUID), `status` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ) | `allowed_persons` (INTEGER DEFAULT 1)<br>`entered_count` (INTEGER DEFAULT 0)<br>`gate_code` (TEXT)<br>`valid_from` (TIMESTAMPTZ)<br>`guest_photo_url` (TEXT)<br>`guest_photo_path` (TEXT)<br>`revoked_at` (TIMESTAMPTZ)<br>`revoked_by` (UUID)<br>`revoke_reason` (TEXT)<br>`archived_at` (TIMESTAMPTZ)<br>`archived_by` (UUID)<br>`archive_reason` (TEXT)<br>`building_id` (UUID) | **Missing 13 columns** in live DB |

### `entry_logs`
| In Live DB / Initial Script | Added by Code | Gap Status |
| :--- | :--- | :--- |
| `id` (UUID PK), `guest_pass_id` (UUID NOT NULL), `security_guard_id` (UUID NOT NULL), `entry_time` (TIMESTAMPTZ), `exit_time` (TIMESTAMPTZ), `status` (TEXT), `notes` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ) | `guard_id` (UUID)<br>`expected_exit_at` (TIMESTAMPTZ)<br>`overstay_started_at` (TIMESTAMPTZ)<br>`checkout_type` (TEXT)<br>`persons_admitted` (INTEGER DEFAULT 1)<br>`id_type` (TEXT)<br>`identity_id_type` (TEXT)<br>`identity_verified` (BOOLEAN DEFAULT FALSE)<br>`entry_photo_url` (TEXT)<br>`entry_photo_path` (TEXT)<br>`visitor_type` (TEXT DEFAULT 'one_time')<br>`visit_request_id` (UUID)<br>`recurring_visitor_id` (UUID)<br>`building_id` (UUID)<br>`gate` (TEXT)<br>`shift` (TEXT)<br>*Note: `guest_pass_id` must be nullable for walk-in/delivery/events* | **Missing 16 columns** in live DB; `guest_pass_id` NOT NULL constraint blocks non-pass entries |

---

## 2. Completely Missing Tables in Live DB

| Table Name | Required Columns |
| :--- | :--- |
| `buildings` | `id`, `name`, `address`, `city`, `country`, `code`, `is_active`, `created_at`, `updated_at` |
| `apartments` | `id`, `building_id`, `block`, `floor`, `unit`, `status`, `resident_id`, `created_at`, `updated_at` |
| `guest_pass_members` | `id`, `guest_pass_id`, `full_name`, `relation`, `is_minor`, `created_at` |
| `pass_extensions` | `id`, `pass_id`, `entry_log_id`, `old_expiry`, `new_expiry`, `extend_hours`, `status`, `requested_by`, `approved_by`, `approval_level`, `reason`, `resolved_at`, `was_overstay`, `created_at` |
| `penalties` | `id`, `resident_id`, `entry_log_id`, `pass_id`, `minutes_over`, `amount_bdt`, `status`, `waived_by`, `waive_reason`, `waived_at`, `month_year`, `created_at`, `updated_at` |
| `policy_settings` | `id`, `overstay_grace_minutes`, `overstay_penalty_rate_bdt`, `overstay_notify_admin_after_minutes`, `ending_soon_warn_minutes`, `max_pass_duration_hours`, `max_extensions_resident`, `max_total_stay_hours`, `delivery_reply_minutes`, `delivery_access_window_min`, `walk_in_reply_minutes`, `event_approval_threshold`, `max_sms_per_resident_per_day`, `sms_critical_only`, `photo_retention_days`, `penalty_enabled`, `updated_by`, `updated_at` |
| `notifications` | `id`, `recipient_id`, `type`, `title`, `body`, `metadata`, `read_at`, `created_at` |
| `notification_preferences`| `user_id`, `inapp_enabled`, `push_enabled`, `push_endpoint`, `push_p256dh`, `push_auth`, `sms_enabled`, `notify_checkin`, `notify_checkout`, `notify_overstay`, `notify_ending_soon`, `notify_delivery`, `notify_walk_in`, `notify_extension`, `notify_penalty`, `notify_revoked`, `notify_event`, `notify_emergency`, `sms_sent_today`, `sms_last_reset_date`, `updated_at` |
| `access_attempts` | `id`, `token_used`, `result`, `guard_id`, `pass_id`, `ip_address`, `created_at` |
| `guard_rate_limits` | `guard_id`, `attempt_count`, `window_start`, `locked_until` |
| `audit_log` | `id`, `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `metadata`, `ip_address`, `created_at` |
| `recurring_visitors` | `id`, `short_id`, `full_name`, `photo_url`, `phone`, `role`, `status`, `valid_until`, `added_by`, `building_id`, `created_at`, `updated_at` |
| `recurring_visitor_apartments` | `id`, `visitor_id`, `apartment`, `resident_id`, `schedule`, `is_active`, `approved_at` |
| `visit_requests` | `id`, `type`, `status`, `visitor_name`, `visitor_phone`, `destination_apt`, `resident_id`, `guard_id`, `purpose`, `notes`, `platform`, `emergency_type`, `responded_at`, `responded_by`, `access_window_min`, `expires_at`, `entry_allowed_until`, `auto_approved`, `created_at`, `updated_at` |
| `events` | `id`, `resident_id`, `name`, `event_type`, `apartment`, `event_date`, `start_time`, `end_time`, `expected_count`, `max_capacity`, `requires_approval`, `approval_status`, `approved_by`, `approved_at`, `rejection_reason`, `counter_token`, `counter_admitted`, `status`, `notes`, `building_id`, `created_at`, `updated_at` |
| `event_guests` | `id`, `event_id`, `name`, `phone`, `qr_token`, `gate_code`, `status`, `arrived_at`, `created_at` |
| `event_coordinators` | `id`, `event_id`, `name`, `phone`, `created_at` |
| `blacklist` | `id`, `name`, `phone`, `photo_url`, `reason`, `scope`, `added_by`, `apartment`, `is_active`, `created_at`, `updated_at` |
| `guard_shifts` | `id`, `guard_id`, `building_id`, `gate`, `shift`, `shift_start`, `shift_end`, `active_from`, `active_until`, `is_current`, `created_by`, `created_at` |
| `family_members` | `id`, `primary_resident_id`, `member_id`, `full_name`, `relation`, `member_type`, `phone`, `can_create_passes`, `is_active`, `building_id`, `created_at`, `updated_at` |

---

## 3. Storage Buckets Gap
- **Live DB**: 0 buckets in `storage.buckets`.
- **Code Requirements**: 3 private buckets (`guest-photos`, `staff-photos`, `entry-photos`) with max file size 5MB and image MIME types, secured with row-level storage policies.

---

## 4. Functions & Procedures Gap
- `current_user_role()` and `current_user_apartment()` SECURITY DEFINER functions with fixed `search_path`.
- `verify_guest_token(p_token TEXT)` supporting 6-digit gate codes and UUID tokens.
- `expire_guest_passes()`, `expire_visit_requests()`, `detect_overstays_full()`, `generate_rv_short_id()`.

---

## 5. Security & Integrity Constraints Gap
- Immutability triggers blocking DELETE on `guest_passes` and `entry_logs`, and blocking UPDATE/DELETE on `audit_log`.
- Headcount validation (`allowed_persons` 1..10), exit timing (`exit_time >= entry_time`), gate code uniqueness on active passes, and Bangladeshi phone format (`^+8801[3-9][0-9]{8}$`).
