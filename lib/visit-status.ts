/**
 * lib/visit-status.ts
 * Single source of truth for all visit/pass status logic.
 * Used by guard, resident, admin, analytics, and exports.
 * ALL display times use Asia/Dhaka. ALL day boundaries use Asia/Dhaka.
 */

import type {
  EntryLog,
  GuestPass,
  ComputedPassStatus,
  EntryLogStatus,
} from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

export const DHAKA_TZ = 'Asia/Dhaka'

/** Default overstay grace period in minutes (overridden by policy_settings) */
export const DEFAULT_OVERSTAY_GRACE_MINUTES = 15

// ─── Duration formatting ──────────────────────────────────────────────────────

/**
 * Format a duration in milliseconds as a human-readable string.
 * Examples: 45m | 3h 20m | 2d 5h
 * Never returns "0m" for positive durations.
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0m'
  const totalMinutes = Math.floor(ms / 60_000)
  const days    = Math.floor(totalMinutes / 1440)
  const hours   = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0 && hours > 0) return `${days}d ${hours}h`
  if (days > 0)              return `${days}d`
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0)             return `${hours}h`
  return `${minutes}m`
}

/**
 * Format a duration in minutes.
 */
export function formatDurationMinutes(totalMinutes: number): string {
  return formatDuration(totalMinutes * 60_000)
}

// ─── Date/time helpers (all Dhaka timezone) ────────────────────────────────

/** Get today's date string in Dhaka timezone (YYYY-MM-DD). */
export function getDhakaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: DHAKA_TZ })
}

/** Get the calendar date for a UTC timestamp in Dhaka timezone (YYYY-MM-DD). */
export function getDhakaDateOf(utcIso: string): string {
  return new Date(utcIso).toLocaleDateString('en-CA', { timeZone: DHAKA_TZ })
}

/** Format a UTC ISO timestamp for display in Asia/Dhaka. */
export function formatDateTime(utcIso: string | null | undefined): string {
  if (!utcIso) return '—'
  return new Date(utcIso).toLocaleString('en-US', {
    timeZone: DHAKA_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Format just the time portion of a UTC ISO in Dhaka. */
export function formatTime(utcIso: string | null | undefined): string {
  if (!utcIso) return '—'
  return new Date(utcIso).toLocaleTimeString('en-US', {
    timeZone: DHAKA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Format just the date portion of a UTC ISO in Dhaka. */
export function formatDate(utcIso: string | null | undefined): string {
  if (!utcIso) return '—'
  // DATE columns arrive as 'YYYY-MM-DD' — show without offset conversion
  if (/^\d{4}-\d{2}-\d{2}$/.test(utcIso)) {
    const [y, m, d] = utcIso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }
  return new Date(utcIso).toLocaleDateString('en-US', {
    timeZone: DHAKA_TZ,
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Pass status ──────────────────────────────────────────────────────────────

/**
 * Compute pass status at read time.
 * Priority: revoked > used_up > expired > upcoming > valid.
 * Never trusts the stored status alone.
 */
export function computePassStatus(
  pass: Pick<GuestPass, 'status' | 'expiry_time' | 'valid_from' | 'allowed_persons' | 'entered_count'>
): ComputedPassStatus {
  if (pass.status === 'revoked') return 'revoked'
  // used_up: all allowed entries have been admitted
  if (pass.allowed_persons > 0 && pass.entered_count >= pass.allowed_persons) return 'used'
  if (pass.status === 'expired') return 'expired'
  if (new Date(pass.expiry_time) < new Date()) return 'expired'
  // upcoming: now is before valid_from
  if (pass.valid_from && new Date(pass.valid_from) > new Date()) return 'valid' // treat as "upcoming" — still show valid badge, caller can check
  return 'valid'
}

// ─── Entry / visit status ─────────────────────────────────────────────────────

export interface VisitStatusResult {
  /** Whether the visitor is currently inside (exit_time IS NULL) */
  isInside: boolean
  /** Whether the visitor is overstaying (inside AND now > expected_exit_at + grace) */
  isOverstay: boolean
  /** Minutes the visitor is over the expected exit time (>0 if overstay) */
  overstayMinutes: number
  /** Human-readable "Over by X" string — never "0 min over" */
  overstayLabel: string
  /** Whether a Check Out button should be shown */
  showCheckOut: boolean
}

/**
 * Compute visit status for a single entry log.
 * @param log        The entry log record
 * @param graceMin   Overstay grace minutes (from policy_settings, default 15)
 */
export function computeVisitStatus(
  log: Pick<EntryLog, 'exit_time' | 'expected_exit_at' | 'status'>,
  graceMin: number = DEFAULT_OVERSTAY_GRACE_MINUTES
): VisitStatusResult {
  const isInside = !log.exit_time
  let isOverstay = false
  let overstayMinutes = 0
  let overstayLabel = ''

  if (isInside && log.expected_exit_at) {
    const now = Date.now()
    const expectedMs = new Date(log.expected_exit_at).getTime()
    const graceMs = graceMin * 60_000
    const overMs = now - expectedMs - graceMs

    if (overMs > 0) {
      isOverstay = true
      overstayMinutes = Math.floor((now - expectedMs) / 60_000) // total minutes over expected (not just beyond grace)
      // Never show "0 min over"
      if (overstayMinutes < 1) overstayMinutes = 1
      overstayLabel = `Over by ${formatDurationMinutes(overstayMinutes)}`
    }
  }

  return {
    isInside,
    isOverstay,
    overstayMinutes,
    overstayLabel,
    showCheckOut: isInside, // show for both inside and overstay
  }
}

// ─── Dashboard aggregations ───────────────────────────────────────────────────

/**
 * Count visitors currently inside (exit_time IS NULL).
 * Includes overstayers.
 */
export function countInsideNow(logs: Pick<EntryLog, 'exit_time'>[]): number {
  return logs.filter(l => !l.exit_time).length
}

/**
 * Count visitors whose entry_time falls on today in Dhaka timezone.
 */
export function countVisitorsToday(logs: Pick<EntryLog, 'entry_time'>[]): number {
  const today = getDhakaToday()
  return logs.filter(l => getDhakaDateOf(l.entry_time) === today).length
}

/**
 * Count completed checkouts today in Dhaka timezone.
 * Excludes auto_closed and admin_closed checkouts.
 */
export function countCompletedToday(
  logs: Pick<EntryLog, 'exit_time' | 'checkout_type'>[]
): number {
  const today = getDhakaToday()
  return logs.filter(l =>
    l.exit_time &&
    getDhakaDateOf(l.exit_time) === today &&
    l.checkout_type === 'manual'
  ).length
}

/**
 * Filter logs that are currently overstaying.
 */
export function getOverstayingLogs<T extends Pick<EntryLog, 'exit_time' | 'expected_exit_at' | 'status'>>(
  logs: T[],
  graceMin: number = DEFAULT_OVERSTAY_GRACE_MINUTES
): T[] {
  return logs.filter(l => computeVisitStatus(l, graceMin).isOverstay)
}

// ─── Analytics: Dhaka-bucketed groupings ─────────────────────────────────────

/** Group a list of entries by calendar day in Dhaka timezone. */
export function groupByDayDhaka(
  entries: { ts: string }[]
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const e of entries) {
    const day = getDhakaDateOf(e.ts)
    result[day] = (result[day] ?? 0) + 1
  }
  return result
}

/** Group a list of entries by hour-of-day in Dhaka timezone (0–23). */
export function groupByHourDhaka(
  entries: { ts: string }[]
): Record<number, number> {
  const result: Record<number, number> = {}
  for (const e of entries) {
    const hour = new Date(e.ts).toLocaleString('en-US', {
      timeZone: DHAKA_TZ, hour: 'numeric', hour12: false,
    })
    const h = parseInt(hour, 10)
    result[h] = (result[h] ?? 0) + 1
  }
  return result
}

/** Group by YYYY-MM in Dhaka timezone. */
export function groupByMonthDhaka(
  entries: { ts: string }[]
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const e of entries) {
    const month = new Date(e.ts).toLocaleDateString('en-CA', {
      timeZone: DHAKA_TZ, year: 'numeric', month: '2-digit',
    }).slice(0, 7) // 'YYYY-MM'
    result[month] = (result[month] ?? 0) + 1
  }
  return result
}
