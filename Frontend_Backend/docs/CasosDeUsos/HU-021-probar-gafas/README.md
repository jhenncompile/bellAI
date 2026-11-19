# HU-021: Visualizar diferentes tipos de gafas sobre mi imagen

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Media |
| Razón (PDF) | Evaluar alternativas que puedan combinar con mi apariencia |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Cinco estilos de gafas (redondas, rectangulares, cat-eye, aviador, oversize) colocados según los ojos y el giro del rostro, con color configurable.

## Cómo funciona

1. La usuaria elige el estilo y el color.
2. Se dibujan sobre la foto alineadas con los landmarks.

## Implementación

**Endpoints**

- `POST /api/simulations` (`kind=gafas`)
- Servicio de IA: `POST /api/v1/simulate/{kind}`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/ai/app/analyzers/simulation.py`

**Tablas**

`simulacion`

## Pruebas y criterios de aceptación

- CP-041-01/02/03/05 del plan de pruebas usan gafas: **OK**.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-021-probar-gafas/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
