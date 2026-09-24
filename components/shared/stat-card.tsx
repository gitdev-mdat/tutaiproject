import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

export function StatCard({ label, value, description, icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {(description || trend) && (
              <div className="mt-1.5 flex items-center gap-2">
                {trend && (
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      trend.positive ? 'text-success' : 'text-destructive'
                    )}
                  >
                    {trend.positive ? '↑' : '↓'} {trend.value}
                  </span>
                )}
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
              </div>
            )}
          </div>
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
