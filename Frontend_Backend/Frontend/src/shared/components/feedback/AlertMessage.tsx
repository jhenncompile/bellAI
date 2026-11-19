import { CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface FeedbackMessage {
  type: 'success' | 'error';
  text: string;
}

interface AlertMessageProps {
  message: FeedbackMessage | null;
  className?: string;
}

/**
 * Banner de feedback de éxito / error usado por los formularios de las features.
 */
export function AlertMessage({ message, className }: AlertMessageProps) {
  if (!message) return null;

  const Icon = message.type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div
      role="status"
      className={cn(
        'p-4 rounded-xl flex items-center gap-3 text-sm animate-in fade-in duration-200',
        message.type === 'success'
          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
          : 'bg-destructive/10 text-destructive border border-destructive/20',
        className
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span>{message.text}</span>
    </div>
  );
}
