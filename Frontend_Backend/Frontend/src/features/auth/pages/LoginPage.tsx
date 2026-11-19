import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../store/auth.store';
import { LoginForm } from '../components/LoginForm';
import { ShieldCheck } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      {/* Background ambient gradient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-card/70 backdrop-blur-xl border border-border/80 rounded-3xl p-8 shadow-2xl space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="size-12 mx-auto rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-lg shadow-primary/25">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Bienvenido de nuevo</h1>
          <p className="text-xs text-muted-foreground">
            Ingresa tus credenciales para acceder al Panel de Administración
          </p>
        </div>

        <LoginForm onSuccess={() => navigate('/dashboard')} />
      </div>
    </div>
  );
}
