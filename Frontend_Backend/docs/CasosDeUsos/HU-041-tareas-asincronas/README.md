# HU-041: Procesar las tareas de visión artificial y renderizado 3D de forma asíncrona

| Campo | Valor |
|---|---|
| Rol | Sistema |
| Prioridad | Alta |
| Razón (PDF) | Evitar que las operaciones pesadas bloqueen la experiencia de la usuaria |
| Planificación | Sprint 1 |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Cola BullMQ sobre Redis (con modo en memoria si no hay Redis), tabla `tarea` con estado y progreso, reintento manual y concurrencia configurable.

## Cómo funciona

1. El endpoint responde 202 con la tarea en «pendiente».
2. El worker la procesa y actualiza el progreso.
3. La app consulta el estado hasta «completada» o «fallida» (con mensaje y reintento).

## Implementación

**Endpoints**

- `GET /api/tasks/:id`
- `POST /api/tasks/:id/retry`
- `GET /api/tasks/stats` (admin)

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/tasks/tasks.service.ts`
- `backend/src/modules/queues`

**Panel web**

- Frontend/src/features/ai-models/pages/AiModelsPage.tsx (estadísticas de tareas).

**Tablas**

`tarea`

## Pruebas y criterios de aceptación

- CP-041-01 Respuesta inmediata en proceso: **OK**
- CP-041-02/03 Seguimiento y resultado: **OK**
- CP-041-04 Fallo con mensaje claro y reintento: **OK**
- CP-041-05 10 tareas simultáneas sin pérdida: **OK**

Los casos CP se ejecutan con `backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py` (sistema levantado con `docker compose up -d`).

## Qué falta o limitaciones

- La notificación es por consulta periódica; no hay notificaciones push.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-041-tareas-asincronas/README.md).
- Panel web: sí.

[← Volver al índice](../README.md)
