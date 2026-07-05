import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; label: string };
  className?: string;
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  iconColor = 'text-blue-400',
  iconBg = 'bg-blue-500/10',
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        'glass-card rounded-2xl p-6 hover:-translate-y-0.5 transition-all duration-300 group',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-extrabold text-white mt-2">{value}</p>
          {trend && (
            <p className="text-xs text-gray-500 mt-1">
              <span
                className={
                  trend.value >= 0 ? 'text-green-400' : 'text-red-400'
                }
              >
                {trend.value >= 0 ? '+' : ''}
                {trend.value}%
              </span>{' '}
              {trend.label}
            </p>
          )}
        </div>
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
            iconBg,
            'group-hover:scale-110 transition-transform duration-300'
          )}
        >
          <Icon className={cn('w-6 h-6', iconColor)} />
        </div>
      </div>
    </div>
  );
}
