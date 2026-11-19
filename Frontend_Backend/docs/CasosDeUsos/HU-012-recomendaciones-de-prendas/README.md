# HU-012: Recibir recomendaciones de prendas según mi perfil

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Encontrar prendas compatibles con mis características y preferencias |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Motor de reglas expertas que cruza diagnóstico, preferencias, Style DNA, ocasión y valoraciones previas.

## Cómo funciona

1. La app pide recomendaciones (opcionalmente por ocasión).
2. El motor devuelve sugerencias con identificadores estables para poder valorarlas.

## Implementación

**Endpoints**

- `GET /api/style/recommendations?occasion=`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/style/recommendation.engine.ts`

## Pruebas y criterios de aceptación

- Jest `style.spec.ts`.
- CP-043-01 del plan de pruebas.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-012-recomendaciones-de-prendas/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
