import type { DashboardMetrics } from '../types/dashboard.types';

interface DistributionItem {
  label: string;
  value: number;
  color: string;
}

function DistributionPanel({
  title,
  description,
  total,
  items,
}: {
  title: string;
  description: string;
  total: number;
  items: DistributionItem[];
}) {
  return (
    <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
      <div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay usuarios registrados.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
              <div
                className="h-2.5 rounded-full bg-muted overflow-hidden"
                role="img"
                aria-label={`${item.label}: ${item.value} de ${total}`}
              >
                <div
                  className={`h-full rounded-full ${item.color}`}
                  style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function UserMetricsChart({ users }: { users: DashboardMetrics['users'] }) {
  const roleData: DistributionItem[] = [
    { label: 'Administradores', value: users.byRole.admin, color: 'bg-primary' },
    { label: 'Managers', value: users.byRole.manager, color: 'bg-chart-2' },
    { label: 'Usuarias', value: users.byRole.user, color: 'bg-chart-3' },
  ];

  const statusData: DistributionItem[] = [
    { label: 'Habilitadas', value: users.byStatus.active, color: 'bg-success' },
    { label: 'Inactivas', value: users.byStatus.inactive, color: 'bg-warning' },
    { label: 'Suspendidas', value: users.byStatus.suspended, color: 'bg-destructive' },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <DistributionPanel
        title="Distribución por roles"
        description="Composición actual de las cuentas registradas por rol."
        total={users.total}
        items={roleData}
      />
      <DistributionPanel
        title="Distribución por estados"
        description="Estado administrativo actual de las cuentas en la plataforma."
        total={users.total}
        items={statusData}
      />
    </div>
  );
}
