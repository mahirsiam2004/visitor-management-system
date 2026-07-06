import { cn } from '@/lib/utils'
import {
  PASS_STATUS_LABELS,
  PASS_STATUS_COLORS,
  ENTRY_STATUS_LABELS,
  ENTRY_STATUS_COLORS,
  ROLE_COLORS,
} from '@/constants'

interface StatusBadgeProps {
  type: 'pass' | 'entry' | 'role'
  status: string
  className?: string
}

export default function StatusBadge({ type, status, className }: StatusBadgeProps) {
  let label = status
  let colorClass = ''

  if (type === 'pass') {
    label = PASS_STATUS_LABELS[status] || status
    colorClass = PASS_STATUS_COLORS[status] || 'bg-slate-50 text-slate-600 border-slate-200'
  } else if (type === 'entry') {
    label = ENTRY_STATUS_LABELS[status] || status
    colorClass = ENTRY_STATUS_COLORS[status] || 'bg-slate-50 text-slate-600 border-slate-200'
  } else if (type === 'role') {
    label = status.charAt(0).toUpperCase() + status.slice(1)
    colorClass = ROLE_COLORS[status] || 'bg-slate-50 text-slate-600 border-slate-200'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        colorClass,
        className
      )}
    >
      {label}
    </span>
  )
}
