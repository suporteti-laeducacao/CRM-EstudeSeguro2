import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  iconColor?: string;
  subtitle?: string;
  highlight?: boolean;
  size?: 'default' | 'compact';
}

const MetricCard = ({ title, value, icon: Icon, trend, iconColor = 'text-primary', subtitle, highlight, size = 'default' }: MetricCardProps) => {
  const isCompact = size === 'compact';
  return (
    <Card
      className={cn(
        'rounded-[14px] border-ink-200 bg-card shadow-card',
        highlight && 'border-t-[3px] border-t-brand'
      )}
    >
      <CardContent className={isCompact ? 'p-4' : 'p-5'}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={cn('text-[13px] font-medium text-ink-500 mb-1', isCompact && 'truncate')}>{title}</p>
            <p className={cn(
              'font-display font-extrabold text-ink-950 tabular-nums',
              isCompact
                ? 'text-[22px] leading-7 whitespace-nowrap'
                : 'text-[28px] xl:text-[34px] leading-9 break-words'
            )}>{value}</p>
            {subtitle && (
              <p className="text-[12.5px] mt-2 text-ink-500 tabular-nums">
                {subtitle}
              </p>
            )}
            {trend && (
              <span
                className={cn(
                  'mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[12.5px] font-medium tabular-nums',
                  trend.positive ? 'bg-[#E7F7F0] text-[#07714E]' : 'bg-[#FDECEC] text-[#B02121]'
                )}
              >
                {trend.positive ? '↑' : '↓'} {trend.value}
              </span>
            )}
          </div>
          <div className={cn('flex shrink-0 items-center justify-center rounded-[10px] bg-ink-100', isCompact ? 'h-8 w-8' : 'h-9 w-9', iconColor)}>
            <Icon className={isCompact ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricCard;
