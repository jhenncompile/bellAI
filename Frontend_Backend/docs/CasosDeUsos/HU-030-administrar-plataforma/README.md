# HU-030: Administrar y supervisar la plataforma

| Campo | Valor |
|---|---|
| Rol | Administrador |
| Prioridad | Alta |
| Razón (PDF) | Mantener el funcionamiento general y gestionar las configuraciones necesarias del sistema |
| Planificación | Sprint 1 |
| Estado | **🟢 Completa** |
| Revisado | 18/11/2026 |

## Situación actual

Panel web solo para administradores: dashboard con métricas, gestión de usuarios (suspender/reactivar, rol), ajustes tipados de la plataforma y bitácora de auditoría.

### Panel de uso y estado de los servicios (HU-30 del backlog v2)

El panel ya no muestra cifras de ejemplo:

- **Usuarias registradas y activas.** «Activas» son las usuarias (rol `user`) que usaron la app en los últimos 30 días (también se muestra la cifra de 7 días). Se mide con la columna nueva `users.last_seen_at` (migración `1700000000012-AddUserLastSeen`): se escribe al iniciar sesión y en cada petición autenticada, como mucho una vez cada 5 minutos por cuenta. La migración la rellena con la actividad que ya existía (bitácora y armario). Las cuentas habilitadas (estado «activa») pasan a ser una cifra secundaria.
- **Servicios de análisis.** Se comprueban de verdad al cargar el panel, con 1,5 s de límite cada uno: visión (`/health` del servicio de IA y modelos cargados), cola de análisis (Redis y tareas fallidas en 24 h), asesora virtual (Ollama y modelo descargado; sin él queda «con limitaciones» porque responde con reglas) y recomendaciones (base de datos). Cada uno es *disponible*, *con limitaciones* o *no disponible*.
- **Espacio de las fotografías.** Se recorre `uploads/` sin bloquear el servidor (resultado reutilizado 1 minuto) y, si hay S3, se suman las imágenes registradas en `media_assets`. Se separan fotos de armario, de análisis, avatares y otras; los modelos 3D y de IA cuentan para el total y la cuota, no como fotos.

## Cómo funciona

1. El administrador inicia sesión en el panel.
2. Ve métricas, gestiona usuarias y cambia ajustes; cada acción queda en la bitácora.

## Implementación

**Endpoints**

- `GET /api/admin/dashboard`
- `PATCH /api/usuarios/:id/status`
- `PATCH /api/usuarios/:id/role`
- `GET/PATCH /api/admin/settings[/:key]`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/admin/dashboard/dashboard.service.ts` y `dashboard.metrics.ts` (reglas de estado, probadas en `dashboard.spec.ts`)
- `backend/src/common/activity/last-seen.ts`
- `backend/src/modules/admin/settings/settings.service.ts`
- `backend/src/modules/users`
- `backend/src/common/guards/roles.guard.ts`

**Panel web**

- Frontend/src/features/dashboard, users, settings y audit (páginas `DashboardPage`, `UsersPage`, `SettingsPage`, `AuditLogsPage`).

**Tablas**

`users` (columna `last_seen_at`), `platform_settings`, `audit_logs`, `media_assets`, `tarea`

## Pruebas y criterios de aceptación

- CP-030-01 Administrador accede al panel: **OK**
- CP-030-02 Usuaria estándar → 403: **OK**
- CP-030-03 Cuenta suspendida no inicia sesión (401): **OK**
- CP-030-04 Cambio de configuración en bitácora: **OK**

Los casos CP se ejecutan con `backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py` (sistema levantado con `docker compose up -d`).

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: no aplica (historia de administración o de sistema sin pantalla propia).
- Panel web: sí.

[← Volver al índice](../README.md)
