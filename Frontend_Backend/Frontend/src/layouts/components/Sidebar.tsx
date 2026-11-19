import { NavLink } from 'react-router';
import { getAvatarUrl } from '@/shared/lib/avatar';
import { useMediaQuery } from '@/shared/lib/use-media-query';
import { useUIStore } from '@/shared/store/ui.store';
import { useAuthStore } from '@/features/auth';
import {
  LayoutDashboard,
  Users,
  User,
  Sliders,
  ShieldCheck,
  Lock,
  LogOut,
  ChevronLeft,
  X,
  Boxes,
  ClipboardList,
  Settings2,
  BrainCircuit,
  LifeBuoy,
  CreditCard,
} from 'lucide-react';

export function Sidebar() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  // Por debajo de 768 px (el `md` de Tailwind) la barra se comporta como menú del móvil
  const isMobile = useMediaQuery('(max-width: 767px)');

  const navItems: Array<{
    label: string;
    icon: typeof LayoutDashboard;
    path: string;
    roles?: ('admin' | 'manager' | 'user')[];
  }> = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Multimedia & CDN', icon: Boxes, path: '/media' },
    { label: 'Usuarios', icon: Users, path: '/users', roles: ['admin'] },
    { label: 'Modelos de IA', icon: BrainCircuit, path: '/ai-models', roles: ['admin', 'manager'] },
    { label: 'Incidencias', icon: LifeBuoy, path: '/incidents', roles: ['admin', 'manager'] },
    { label: 'Suscripciones', icon: CreditCard, path: '/payments', roles: ['admin', 'manager'] },
    { label: 'Auditoría', icon: ClipboardList, path: '/audit-logs', roles: ['admin'] },
    { label: 'Configuración', icon: Settings2, path: '/settings', roles: ['admin'] },
    { label: 'Mi Perfil', icon: User, path: '/profile' },
    { label: 'Preferencias', icon: Sliders, path: '/preferences' },
    { label: 'Privacidad & GDPR', icon: Lock, path: '/privacy' },
  ];

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role)),
  );

  const handleNavClick = () => {
    // Si la pantalla es móvil (< 768px), cerrar el sidebar al hacer click en un enlace
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay para pantallas Android / iPhone */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-screen bg-card border-r border-border transition-all duration-300 flex flex-col justify-between ${
          sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-20'
        }`}
      >
        {/* Top Brand Header */}
        <div>
          <div className="h-16 px-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-md shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              {(sidebarOpen || isMobile) && (
                <div className="transition-opacity duration-200">
                  <h1 className="font-bold text-sm leading-tight text-foreground truncate">
                    Sistema Bellia
                  </h1>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Admin & Seguridad
                  </p>
                </div>
              )}
            </div>

            {/* Botón colapsar para Desktop */}
            <button
              onClick={toggleSidebar}
              className="hidden md:flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={sidebarOpen ? 'Colapsar menú' : 'Expandir menú'}
            >
              <ChevronLeft
                className={`size-4 transition-transform duration-300 ${
                  !sidebarOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Botón cerrar para Móviles Android */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Cerrar menú"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`
                  }
                >
                  <Icon className="size-5 shrink-0" />
                  <span
                    className={`transition-opacity duration-200 whitespace-nowrap ${
                      !sidebarOpen && 'md:hidden'
                    }`}
                  >
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer User & Logout */}
        <div className="p-3 border-t border-border space-y-2">
          {user && sidebarOpen && (
            <div className="px-3 py-2 rounded-xl bg-muted/40 flex items-center gap-3">
              <img
                src={getAvatarUrl(user.email, user.avatar)}
                alt={user.name}
                className="size-8 rounded-full border border-border object-cover"
              />
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              handleNavClick();
              logout();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl font-medium text-xs text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            <span className={!sidebarOpen ? 'md:hidden' : ''}>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
