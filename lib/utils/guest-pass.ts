import { v4 as uuidv4 } from 'uuid'

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

export function calculateExpiryTime(
  visitDate: string,
  visitTime: string,
  durationHours: number
): Date {
  const [year, month, day] = visitDate.split('-').map(Number)
  const [hours, minutes] = visitTime.split(':').map(Number)
  const visitDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0)
  visitDateTime.setTime(visitDateTime.getTime() + durationHours * 60 * 60 * 1000)
  return visitDateTime
}

export function isPassExpired(expiryTime: string): boolean {
  return new Date(expiryTime) < new Date()
}

export function getPassTimeRemaining(expiryTime: string): string {
  const now = new Date()
  const expiry = new Date(expiryTime)
  const diff = expiry.getTime() - now.getTime()

  if (diff <= 0) return 'Expired'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`
  }
  return `${minutes}m remaining`
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(timeString: string): string {
  if (timeString.includes('T')) {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  const [hours, minutes] = timeString.split(':')
  const date = new Date()
  date.setHours(parseInt(hours), parseInt(minutes))
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
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

export function getTodayString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
