# HU-014: Obtener recomendaciones explicadas

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Comprender qué características de mi perfil fueron consideradas para generar cada sugerencia |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Cada sugerencia trae factor, valor y regla aplicada; el asistente local puede explicarla en lenguaje natural (HU-042).

## Cómo funciona

1. La app muestra el «por qué» de cada sugerencia.
2. Con «Explícamelo» se llama al LLM local.

## Implementación

**Endpoints**

- `GET /api/style/recommendations`
- `POST /api/assistant/explain`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/style/recommendation.engine.ts`
- `backend/src/modules/assistant/assistant.service.ts`

## Pruebas y criterios de aceptación

- Jest `style.spec.ts`.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-014-recomendaciones-explicadas/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
