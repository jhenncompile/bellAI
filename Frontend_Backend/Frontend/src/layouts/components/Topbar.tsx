import { getAvatarUrl } from '@/shared/lib/avatar';
import { useUIStore } from '@/shared/store/ui.store';
import { useAuthStore } from '@/features/auth';
import { Sun, Moon, Bell, Search, Menu } from 'lucide-react';
import { useNavigate } from 'react-router';

export function Topbar() {
  const theme = useUIStore((state) => state.theme);
  const toggleTheme = useUIStore((state) => state.toggleTheme);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  return (
    <header className="h-16 border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Botón Hamburguesa Móvil (Visible solo en pantallas < md) */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Abrir menú de navegación"
        >
          <Menu className="size-5" />
        </button>

        {/* Search Input (Adaptable) */}
        <div className="relative w-44 sm:w-64 lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-1.5 bg-input/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground/60 transition-all"
          />
        </div>
      </div>

      {/* Action Icons */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Alternar Tema"
        >
          {theme === 'dark' ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-slate-700" />}
        </button>

        <button
          className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative hidden sm:flex"
          title="Notificaciones"
        >
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
        </button>

        <div className="h-6 w-px bg-border mx-0.5 sm:mx-1 hidden sm:block" />

        {user && (
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-muted/60 transition-colors"
            title="Ir a mi perfil"
          >
            <img
              src={getAvatarUrl(user.email, user.avatar)}
              alt={user.name}
              className="size-8 rounded-full border border-border object-cover"
            />
            <span className="text-xs font-medium text-foreground hidden sm:inline max-w-[120px] truncate">
              {user.name}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
