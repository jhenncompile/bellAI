# HU-019: Visualizar cambios virtuales de cabello y color

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Experimentar con diferentes estilos y colores antes de realizar un cambio real |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟡 Parcial** |
| Revisado | 15/11/2026 |

## Situación actual

Cambio de color de cabello sobre la foto con segmentación de cabello y mezcla en espacio de color. Corre como tarea asíncrona.

## Cómo funciona

1. La usuaria sube la foto y elige el color.
2. Se segmenta el cabello y se recolorea conservando la textura.
3. El resultado queda en su historial.

## Implementación

**Endpoints**

- `GET /api/simulations/options`
- `POST /api/simulations` (`kind=color_cabello`) → 202
- `GET /api/simulations/:id/image`
- Servicio de IA: `POST /api/v1/simulate/{kind}`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/ai/app/analyzers/simulation.py`
- `backend/src/modules/simulations/simulations.service.ts`

**Tablas**

`simulacion`, `tarea`

## Pruebas y criterios de aceptación

- pytest de simulación.

## Qué falta o limitaciones

- Solo cambia el color; no hay cambio de corte o peinado.
- Es edición 2D por visión, no un modelo generativo local como pide el requisito «IA generativa» (4.1.3).

## Plataformas

- Móvil: **🟡 Parcial** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-019-cambios-de-cabello-y-color/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
