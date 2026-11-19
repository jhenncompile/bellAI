# HU-027: Consultar recomendaciones relacionadas con compras

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Media |
| Razón (PDF) | Recibir orientación para decidir si una nueva prenda puede complementar mi armario y perfil |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

El semáforo de compatibilidad indica cuántas prendas del armario combinan con la nueva; el asistente responde preguntas de compra con el contexto del armario.

## Cómo funciona

1. Desde «¿Me lo compro?» o el asistente.

## Implementación

**Endpoints**

- `POST /api/compatibility`
- `/api/assistant/...`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/compatibility/compatibility.engine.ts`
- `backend/src/modules/assistant/assistant.service.ts`

## Pruebas y criterios de aceptación

- Jest.

## Qué falta o limitaciones

- No hay catálogo de tiendas ni enlaces de compra.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-027-recomendaciones-de-compra/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
