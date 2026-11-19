# HU-033: Supervisar los recursos multimedia y modelos del sistema

| Campo | Valor |
|---|---|
| Rol | Administrador |
| Prioridad | Media |
| Razón (PDF) | Controlar los recursos necesarios para fotografías, prendas, modelos 3D y componentes de IA |
| Planificación | Sprint 1 |
| Estado | **🟢 Completa** |
| Revisado | 18/11/2026 |

## Situación actual

Uso de almacenamiento frente a una cuota configurable, alerta al superar el 90 % (incidencia de prioridad alta), estado y versión de los modelos, y limpieza de archivos huérfanos con simulación previa.

## Cómo funciona

1. El panel muestra espacio usado, número de archivos y la barra de cuota.
2. Por encima del 90 % se abre una incidencia (una sola mientras siga abierta); también se revisa cada hora.
3. «Buscar archivos huérfanos» lista los que no tienen referencia y, si se confirma, los elimina.

## Implementación

**Endpoints**

- `GET /api/media/stats/overview`
- `POST /api/media/cleanup-orphans?dryRun=`
- `GET /api/admin/ai-models`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/media/storage-monitor.service.ts`
- `backend/src/modules/media/media.controller.ts`
- `backend/src/modules/media/media.service.ts`

**Panel web**

- Frontend/src/features/media/pages/MediaPage.tsx.

**Tablas**

`media_assets`, `incidencia`, `platform_settings` (`storage_quota_gb`)

## Pruebas y criterios de aceptación

- CP-033-01 Espacio usado y cantidad de archivos: **OK**
- CP-033-02 Estado y versión de los modelos: **OK**
- CP-033-03 Alerta al superar el 90 %: **OK**
- CP-033-04 Huérfanos detectados y eliminados: **OK**

Los casos CP se ejecutan con `backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py` (sistema levantado con `docker compose up -d`).

## Qué falta o limitaciones

- La alerta llega como incidencia en el panel; no se envía correo.
- El panel general (`GET /api/admin/dashboard`) muestra además el espacio de las fotografías por tipo (armario, análisis, avatares, otras) frente a la cuota; ver HU-030.

## Plataformas

- Móvil: no aplica (historia de administración o de sistema sin pantalla propia).
- Panel web: sí.

[← Volver al índice](../README.md)
