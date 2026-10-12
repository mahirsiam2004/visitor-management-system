# PROGRESS Tracking

## Phase 0: done
- Stabilized TypeScript compilation and build errors across admin, resident, and security routes.
- Completed comprehensive browser audit across all roles (Resident, Security, Admin).
- Documented all schema cache errors, UI bugs, and logic gaps in BUGS.md.

## Step 1: done
- Switched all guest pass and entry log reads/writes to real columns and enforced plain-text purpose and notes.

## Steps 2+3: done
- lib/visit-status.ts is single source of truth for insideNow/completedToday/overstay counts across security and admin.
- Analytics Dhaka timezone groupings (hour/day/month), avgStay excludes auto_closed, overstayCount uses computeVisitStatus.
- Chart title "(UTC)" renamed to "(Dhaka time)".
- Check Out button shown for overstay on guard dashboard; uses server-side now(), writes audit_log.
