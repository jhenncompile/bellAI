import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bot, Camera, RefreshCw, Settings2, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { SettingToggleCard } from '../components/SettingToggleCard';
import { settingsService } from '../services/settings.service';
import { getApiErrorMessage, getApiErrorStatus } from '@/shared/lib/api-error';
import { SETTING_GROUPS, type SettingKey, type SettingValue } from '../types/settings.types';

const GROUP_ICONS = { plataforma: SlidersHorizontal, fotografias: Camera, ia: Bot } as const;

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: settingsService.getSettings,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: SettingKey; value: SettingValue }) =>
      settingsService.updateSetting(key, value),
    onSuccess: (updated) => {
      queryClient.setQueryData<typeof settingsQuery.data>(['admin-settings'], (old) => {
        if (!old) return [updated];
        return old.map((item) => (item.key === updated.key ? updated : item));
      });
      // Invalidar también las métricas del dashboard
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSuccessMessage('Configuración actualizada correctamente.');
      setSaveError(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (error) => {
      setSaveError(
        getApiErrorMessage(error, 'No fue posible guardar la nueva configuración.'),
      );
    },
  });

  const handleChange = (key: SettingKey, currentValue: SettingValue, nextValue: SettingValue) => {
    if (currentValue === nextValue) return;
    setSuccessMessage(null);
    setSaveError(null);
    updateMutation.mutate({ key, value: nextValue });
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <PageHeader />
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-64 rounded-2xl bg-muted/50 border border-border animate-pulse"
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          Cargando configuraciones...
        </p>
      </div>
    );
  }

  if (settingsQuery.error || !settingsQuery.data) {
    const status = getApiErrorStatus(settingsQuery.error);
    const title =
      status === 403
        ? 'Acceso denegado'
        : status === 401
        ? 'Sesión expirada'
        : 'No se pudieron cargar las configuraciones';

    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="bg-card border border-destructive/30 rounded-2xl p-6 text-center space-y-4">
          <AlertTriangle className="size-10 mx-auto text-destructive" />
          <div>
            <h2 className="font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {getApiErrorMessage(
                settingsQuery.error,
                'No fue posible consultar las configuraciones de la plataforma.',
              )}
            </p>
          </div>
          {status !== 401 && (
            <Button
              variant="outline"
              onClick={() => {
                void settingsQuery.refetch();
              }}
            >
              <RefreshCw className="size-4 mr-2" />
              Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }

  const pendingKey = updateMutation.isPending ? updateMutation.variables?.key : null;

  return (
    <div className="space-y-6">
      <PageHeader />

      {successMessage && (
        <div
          className="p-4 text-sm rounded-xl bg-primary/10 text-foreground border border-primary/25"
          role="status"
        >
          {successMessage}
        </div>
      )}

      {saveError && (
        <div
          className="p-4 text-sm rounded-xl bg-destructive/15 text-destructive border border-destructive/30"
          role="alert"
        >
          {saveError} Puedes volver a intentarlo.
        </div>
      )}

      {SETTING_GROUPS.map((group) => {
        const items = settingsQuery.data.filter((setting) => setting.group === group.id);
        if (!items.length) return null;
        const Icon = GROUP_ICONS[group.id];
        return (
          <section key={group.id} className="space-y-3" aria-labelledby={`grupo-${group.id}`}>
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-primary" aria-hidden="true" />
              <h2 id={`grupo-${group.id}`} className="font-bold text-foreground">
                {group.title}
              </h2>
              <span className="text-xs text-muted-foreground">· {group.description}</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((setting) => (
                <SettingToggleCard
                  key={`${setting.key}:${String(setting.value)}`}
                  setting={setting}
                  isSaving={pendingKey === setting.key}
                  disabled={updateMutation.isPending || settingsQuery.isFetching}
                  onChange={(value) => handleChange(setting.key, setting.value, value)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
        <Settings2 className="size-5" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración de plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Políticas operativas, umbrales de fotografía y parámetros de IA de BellAI.
        </p>
      </div>
    </div>
  );
}
