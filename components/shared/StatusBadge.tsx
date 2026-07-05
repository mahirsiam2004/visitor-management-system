import { getStatusColor } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inside: 'Inside',
  completed: 'Completed',
  expired: 'Expired',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(status)}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'active'
            ? 'bg-blue-400 animate-pulse'
            : status === 'inside'
            ? 'bg-green-400 animate-pulse'
            : status === 'completed'
            ? 'bg-gray-400'
            : 'bg-red-400'
        }`}
      />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
