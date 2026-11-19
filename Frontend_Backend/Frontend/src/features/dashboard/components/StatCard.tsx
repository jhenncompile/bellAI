import type { ElementType } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  icon: ElementType;
}

/** Tarjeta de métrica individual del panel general. */
export function StatCard({ title, value, change, isPositive, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:border-primary/40 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        <span
          className={`inline-flex items-center text-xs font-medium ${
            isPositive ? 'text-success' : 'text-destructive'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="size-3.5 mr-1" />
          ) : (
            <TrendingDown className="size-3.5 mr-1" />
          )}
          {change}
        </span>
      </div>
    </div>
  );
}
