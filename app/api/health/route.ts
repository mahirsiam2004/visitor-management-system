import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const EXPECTED_SCHEMA: Record<string, string[]> = {
  apartments: ['id', 'building_id', 'block', 'floor', 'unit', 'status'],
  pass_extensions: ['id', 'pass_id', 'entry_log_id', 'old_expiry', 'new_expiry', 'extend_hours', 'status'],
  penalties: ['id', 'resident_id', 'entry_log_id', 'pass_id', 'minutes_over', 'amount_bdt', 'status', 'month_year'],
  blacklist: ['id', 'name', 'phone', 'reason', 'scope', 'added_by', 'is_active'],
  events: ['id', 'resident_id', 'name', 'event_type', 'apartment', 'event_date', 'start_time', 'end_time', 'status'],
  event_guests: ['id', 'event_id', 'name', 'phone', 'qr_token', 'status'],
  recurring_visitors: ['id', 'short_id', 'full_name', 'phone', 'role', 'status', 'added_by'],
  recurring_visitor_apartments: ['id', 'visitor_id', 'apartment', 'resident_id', 'schedule', 'is_active'],
  visit_requests: ['id', 'type', 'status', 'visitor_name', 'destination_apt', 'resident_id', 'guard_id'],
  access_attempts: ['id', 'token_used', 'result', 'guard_id', 'pass_id'],
  audit_log: ['id', 'actor_id', 'actor_role', 'action', 'entity_type', 'metadata'],
  notifications: ['id', 'recipient_id', 'type', 'title', 'body'],
  notification_preferences: ['user_id', 'inapp_enabled', 'sms_enabled'],
  policy_settings: ['id', 'overstay_grace_minutes', 'overstay_penalty_rate_bdt', 'max_pass_duration_hours'],
  guest_passes: [
    'id', 'guest_id', 'guest_name', 'resident_id', 'apartment_number',
    'allowed_persons', 'entered_count', 'gate_code', 'valid_from',
    'guest_photo_url', 'revoked_at', 'revoked_by', 'revoke_reason', 'archived_at'
  ],
  entry_logs: [
    'id', 'guest_pass_id', 'security_guard_id', 'entry_time', 'exit_time',
    'expected_exit_at', 'checkout_type', 'overstay_started_at', 'persons_admitted',
    'visitor_type', 'guard_id'
  ],
  profiles: ['id', 'email', 'full_name', 'role', 'is_active', 'building_id'],
  buildings: ['id', 'name', 'code', 'is_active'],
  guard_shifts: ['id', 'guard_id', 'building_id', 'shift', 'is_current'],
  family_members: ['id', 'primary_resident_id', 'full_name', 'member_type'],
  guest_pass_members: ['id', 'guest_pass_id', 'full_name', 'relation'],
}

export async function GET(request: NextRequest) {
  // Authorization: Session check or Service Role Key in header
  const authHeader = request.headers.get('authorization')
  const secretHeader = request.headers.get('x-admin-key')
  const isServiceRole = secretHeader === process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (authHeader && authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`)

  if (!isServiceRole) {
    const auth = await getAuthContext()
    if (!auth.ok || auth.ctx.profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin role required to view database health status.' },
        { status: 403 }
      )
    }
  }

  const supabase = createAdminClient()
  const missingTables: string[] = []
  const missingColumns: Record<string, string[]> = {}
  const statusDetails: Record<string, { ok: boolean; error?: string; missingColumns?: string[] }> = {}

  for (const [table, columns] of Object.entries(EXPECTED_SCHEMA)) {
    // 1. Probe whole table existence
    const { error: tableError } = await supabase.from(table).select('*').limit(0)

    if (tableError) {
      if (
        tableError.code === 'PGRST205' ||
        tableError.message.includes('Could not find the table') ||
        tableError.message.includes('relation')
      ) {
        missingTables.push(table)
        statusDetails[table] = { ok: false, error: `Table '${table}' not found in schema cache` }
        continue
      }
    }

    // 2. Probe required columns individually
    const tableMissingCols: string[] = []
    for (const col of columns) {
      const { error: colError } = await supabase.from(table).select(col).limit(0)
      if (colError) {
        if (
          colError.code === 'PGRST204' ||
          colError.message.includes('Could not find the column') ||
          colError.message.includes('does not exist')
        ) {
          tableMissingCols.push(col)
        }
      }
    }

    if (tableMissingCols.length > 0) {
      missingColumns[table] = tableMissingCols
      statusDetails[table] = {
        ok: false,
        error: `Missing columns: ${tableMissingCols.join(', ')}`,
        missingColumns: tableMissingCols,
      }
    } else {
      statusDetails[table] = { ok: true }
    }
  }

  const isHealthy = missingTables.length === 0 && Object.keys(missingColumns).length === 0

  return NextResponse.json({
    status: isHealthy ? 'healthy' : 'degraded',
    checkedAt: new Date().toISOString(),
    timezone: 'Asia/Dhaka',
    totalTablesChecked: Object.keys(EXPECTED_SCHEMA).length,
    missingTablesCount: missingTables.length,
    missingTables,
    missingColumnsCount: Object.keys(missingColumns).length,
    missingColumns,
    details: statusDetails,
  }, {
    status: isHealthy ? 200 : 503,
  })
}
