import { Search, Filter } from 'lucide-react';

interface UsersFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

/** Barra de búsqueda y filtro por rol del listado de usuarios. */
export function UsersFilterBar({
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
}: UsersFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 bg-card border border-border rounded-2xl p-3 shadow-sm">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por nombre o correo..."
          className="w-full pl-10 pr-4 py-2 bg-input/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
        />
      </div>

      <div className="flex items-center gap-2">
        <Filter className="size-4 text-muted-foreground ml-1" />
        <select
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
          className="px-3 py-2 bg-input/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
        >
          <option value="all">Todos los Roles</option>
          <option value="admin">Administrador</option>
          <option value="manager">Gerente</option>
          <option value="user">Usuario App</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label="Filtrar por estado"
          className="px-3 py-2 bg-input/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
        >
          <option value="all">Todos los Estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="suspended">Suspendido</option>
        </select>
      </div>
    </div>
  );
}
