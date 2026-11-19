# HU-031: Gestionar incidencias reportadas por las usuarias

| Campo | Valor |
|---|---|
| Rol | Administrador |
| Prioridad | Media |
| Razón (PDF) | Identificar y atender problemas relacionados con el funcionamiento del sistema |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Las usuarias reportan desde la app; el administrador las ve, prioriza, cambia de estado y responde en el panel. El monitor de almacenamiento también abre incidencias automáticas.

## Cómo funciona

1. La usuaria envía el reporte con contexto.
2. El administrador lo atiende en la página de incidencias.

## Implementación

**Endpoints**

- `POST /api/incidents`
- `GET /api/incidents/mine`
- `GET/PATCH /api/admin/incidents[...]`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/incidents/incidents.service.ts`

**Panel web**

- Frontend/src/features/incidents/pages/IncidentsPage.tsx.

**Tablas**

`incidencia`

## Pruebas y criterios de aceptación

- Emulador (envío) y panel web.

## Qué falta o limitaciones

- No hay aviso a la usuaria cuando cambia el estado, salvo al volver a consultar «mis reportes».

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-031-gestionar-incidencias/README.md).
- Panel web: sí.

[← Volver al índice](../README.md)
