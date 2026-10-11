import type { RecurringVisitorSchedule } from '@/types'

/** Pure utility — check if a recurring visitor is within their approved schedule */
export function isOnSchedule(schedule: RecurringVisitorSchedule): {
  onSchedule: boolean
  reason?: string
} {
  const now   = new Date()
  const dhaka = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }))
  const dayMap: Record<number, string> = {
    0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
  }
  const today = dayMap[dhaka.getDay()]
  const hhmm  = `${String(dhaka.getHours()).padStart(2, '0')}:${String(dhaka.getMinutes()).padStart(2, '0')}`

  if (!schedule.days || schedule.days.length === 0) return { onSchedule: true }
  if (!schedule.days.includes(today)) {
    return { onSchedule: false, reason: `Not scheduled on ${today}` }
  }
  if (schedule.start && hhmm < schedule.start) {
    return { onSchedule: false, reason: `Too early — schedule starts ${schedule.start}` }
  }
  if (schedule.end && hhmm > schedule.end) {
    return { onSchedule: false, reason: `Too late — schedule ended ${schedule.end}` }
  }
  return { onSchedule: true }
}
