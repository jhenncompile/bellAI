# HU-028: Consultar mi historial de recomendaciones, simulaciones y elecciones

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Media |
| Razón (PDF) | Revisar las interacciones anteriores utilizadas para personalizar mi experiencia |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Historial unificado de diagnósticos, valoraciones, outfits y simulaciones.

## Cómo funciona

1. La app pide el historial y lo agrupa por tipo y fecha.

## Implementación

**Endpoints**

- `GET /api/style/history`
- `GET /api/diagnosis`
- `GET /api/simulations`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/style/style.service.ts`
- `backend/src/modules/style/style.controller.ts`

## Pruebas y criterios de aceptación

- Emulador.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-028-historial/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
