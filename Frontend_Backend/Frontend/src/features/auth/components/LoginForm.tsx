import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Mail, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { CREDENCIALES_DEMO, loginSchema, type LoginFormValues } from '../schemas/login.schema';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: CREDENCIALES_DEMO,
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setLoading(true);
      setError(null);
      const data = await authService.login(values);
      login(data.user, data.token);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    setValue('email', CREDENCIALES_DEMO.email);
    setValue('password', CREDENCIALES_DEMO.password);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="p-3 text-sm rounded-lg bg-destructive/15 text-destructive border border-destructive/30">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Correo Electrónico
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            {...register('email')}
            type="email"
            placeholder="valeria@bellia.com"
            className="w-full pl-10 pr-4 py-2.5 bg-input/40 border border-border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary placeholder:text-muted-foreground/60"
          />
        </div>
        {errors.email && (
          <p className="text-xs text-destructive mt-1 font-medium">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Contraseña
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            {...register('password')}
            type="password"
            placeholder="••••••••"
            className="w-full pl-10 pr-4 py-2.5 bg-input/40 border border-border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary placeholder:text-muted-foreground/60"
          />
        </div>
        {errors.password && (
          <p className="text-xs text-destructive mt-1 font-medium">{errors.password.message}</p>
        )}
      </div>

      <div className="pt-2 flex flex-col gap-2">
        <Button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all shadow-md"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" />
              Iniciando Sesión...
            </>
          ) : (
            'Iniciar Sesión'
          )}
        </Button>

        <button
          type="button"
          onClick={handleDemoFill}
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 mt-1"
        >
          <KeyRound className="size-3.5" />
          Usar credenciales de administrador ({CREDENCIALES_DEMO.email})
        </button>
      </div>
    </form>
  );
}
