import { cn } from '@/shared/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
}

/**
 * Indicador de carga a pantalla completa para las vistas que esperan datos.
 */
export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center min-h-[400px]', className)}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}
