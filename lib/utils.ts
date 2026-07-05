import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

/** Merge Tailwind CSS classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a date string to a human-readable format */
export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM dd, yyyy');
}

/** Format a date string to include time */
export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
}

/** Format time to 12-hour format */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/** Get relative time (e.g., "2 hours ago") */
export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/** Calculate expiry date from visitDate, visitTime and duration */
export function calculateExpiry(
  visitDate: string,
  visitTime: string,
  durationHours: number
): Date {
  const [year, month, day] = visitDate.split('-').map(Number);
  const [hours, minutes] = visitTime.split(':').map(Number);
  const visitStart = new Date(year, month - 1, day, hours, minutes, 0);
  return new Date(visitStart.getTime() + durationHours * 60 * 60 * 1000);
}

/** Check if a date is in the past (expired) */
export function isExpired(date: string | Date): boolean {
  return new Date(date) < new Date();
}

/** Get status badge color */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'inside':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'completed':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    case 'expired':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

/** Format duration in hours to human-readable string */
export function formatDuration(hours: number): string {
  if (hours === 1) return '1 Hour';
  if (hours < 24) return `${hours} Hours`;
  return '24 Hours';
}

/** Convert object to CSV string */
export function toCSV(data: Record<string, unknown>[], headers: string[]): string {
  const rows = data.map((row) =>
    headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

/** Trigger CSV download in browser */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
