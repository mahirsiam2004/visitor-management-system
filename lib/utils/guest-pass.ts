import { v4 as uuidv4 } from 'uuid'
import type { GuestPass, ComputedPassStatus } from '@/types'

// Asia/Dhaka is UTC+6
const DHAKA_TZ = 'Asia/Dhaka'

export function generateQRToken(): string {
  return uuidv4()
}

export function generateGuestId(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `G-${timestamp}-${random}`
}

export function buildQRUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/verify/${token}`
}

/**
 * Compute expiry time in UTC.
 * visitDate: 'YYYY-MM-DD' (date entered by user in Dhaka local time)
 * visitTime: 'HH:MM'      (time entered by user in Dhaka local time)
 * We interpret both as Asia/Dhaka, then convert to UTC for storage.
 */
export function calculateExpiryTime(
  visitDate: string,
  visitTime: string,
  durationHours: number
): Date {
  // Build an ISO string with the Dhaka offset (+06:00)
  const localIso = `${visitDate}T${visitTime}:00+06:00`
  const visitUTC = new Date(localIso)
  if (isNaN(visitUTC.getTime())) {
    throw new Error(`Invalid visitDate/visitTime: ${visitDate} ${visitTime}`)
  }
  return new Date(visitUTC.getTime() + durationHours * 60 * 60 * 1000)
}

export function isPassExpired(expiryTime: string): boolean {
  return new Date(expiryTime) < new Date()
}

/**
 * Returns the authoritative display status for a pass.
 * Never trusts the stored `status` alone — always re-checks expiry_time.
 */
export function getComputedPassStatus(pass: Pick<GuestPass, 'status' | 'expiry_time'>): ComputedPassStatus {
  if (pass.status === 'revoked') return 'revoked'
  if (pass.status === 'used') return 'used'
  if (pass.status === 'expired' || isPassExpired(pass.expiry_time)) return 'expired'
  return 'valid'
}

export function getPassTimeRemaining(expiryTime: string): string {
  const now = new Date()
  const expiry = new Date(expiryTime)
  const diff = expiry.getTime() - now.getTime()

  if (diff <= 0) return 'Expired'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
}

/** Format a UTC timestamp for display in Asia/Dhaka */
export function formatDateTime(dateString: string): string {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString('en-US', {
    timeZone: DHAKA_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Format just the date portion in Asia/Dhaka */
export function formatDate(dateString: string): string {
  if (!dateString) return '—'
  // DATE columns (visit_date) come as 'YYYY-MM-DD' — parse without timezone conversion
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  return new Date(dateString).toLocaleDateString('en-US', {
    timeZone: DHAKA_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Format just a TIME column (HH:MM or ISO string) for display in Dhaka */
export function formatTime(timeString: string): string {
  if (!timeString) return '—'
  if (timeString.includes('T')) {
    return new Date(timeString).toLocaleTimeString('en-US', {
      timeZone: DHAKA_TZ,
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  // Plain 'HH:MM' from TIME column — display as-is interpreted in Dhaka
  const [hours, minutes] = timeString.split(':')
  const d = new Date()
  d.setHours(parseInt(hours), parseInt(minutes))
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function calculateVisitDuration(entryTime: string, exitTime?: string): string {
  const entry = new Date(entryTime)
  const exit = exitTime ? new Date(exitTime) : new Date()
  const diff = exit.getTime() - entry.getTime()

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export function getOverstayMinutes(expectedExitAt: string): number {
  const now = new Date()
  const expected = new Date(expectedExitAt)
  const diff = now.getTime() - expected.getTime()
  return Math.max(0, Math.floor(diff / 60000))
}

export function getTodayString(): string {
  // Return today's date in Dhaka timezone as YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: DHAKA_TZ })
}

/** Normalize a Bangladesh phone number to +8801XXXXXXXXX */
export function normalizeBdPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('8801') && digits.length === 13) return `+${digits}`
  if (digits.startsWith('01') && digits.length === 11) return `+88${digits}`
  return `+${digits}`
}

/**
 * Generate a cryptographically random 6-digit gate code.
 * Uses crypto.getRandomValues for ≥20 bits of entropy.
 */
export function generateGateCode(): string {
  // Produce a number in [100000, 999999]
  const array = new Uint32Array(1)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    // Fallback for non-browser environments (Node.js)
    const { randomBytes } = require('crypto') as typeof import('crypto')
    array[0] = randomBytes(4).readUInt32BE(0)
  }
  return String(100000 + (array[0] % 900000))
}

/**
 * Calculate the valid_from time: visit_time in Dhaka minus bufferMinutes.
 * Returns a UTC Date.
 */
export function calculateValidFrom(
  visitDate: string,
  visitTime: string,
  bufferMinutes: number = 30
): Date {
  const localIso = `${visitDate}T${visitTime}:00+06:00`
  const visitUTC = new Date(localIso)
  return new Date(visitUTC.getTime() - bufferMinutes * 60 * 1000)
}

/** Build the public pass share URL */
export function buildPassUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/pass/${token}`
}
