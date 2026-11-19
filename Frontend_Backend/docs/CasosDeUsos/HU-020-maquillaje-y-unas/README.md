# HU-020: Visualizar propuestas virtuales de maquillaje y uñas

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Media |
| Razón (PDF) | Experimentar y comparar diferentes alternativas de apariencia |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟡 Parcial** |
| Revisado | 15/11/2026 |

## Situación actual

Labial, rubor y sombras sobre los landmarks del rostro; uñas sobre los puntos de la mano (Hand Landmarker).

## Cómo funciona

1. Se elige el tipo (maquillaje o uñas) y el color.
2. Si no se detecta la mano, la tarea falla con un mensaje claro y se puede reintentar.

## Implementación

**Endpoints**

- `POST /api/simulations` (`kind=maquillaje|unas`)
- Servicio de IA: `POST /api/v1/simulate/{kind}`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/ai/app/analyzers/simulation.py`

**Tablas**

`simulacion`

## Pruebas y criterios de aceptación

- CP-041-04 del plan de pruebas (uñas sin mano → «No se detectaron manos…»): **OK**.

## Qué falta o limitaciones

- Edición 2D, no generativa.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-020-maquillaje-y-unas/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
