import { Link } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import { Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-8xl font-black text-primary/30">404</h1>
      <h2 className="text-2xl font-bold mt-2">Página No Encontrada</h2>
      <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
        La ruta que intentas visitar no existe o no tienes permisos para acceder.
      </p>
      <Link to="/dashboard">
        <Button className="gap-2">
          <Home className="size-4" />
          Volver al Inicio
        </Button>
      </Link>
    </div>
  );
}
