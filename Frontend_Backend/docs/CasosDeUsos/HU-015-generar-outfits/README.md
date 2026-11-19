# HU-015: Generar outfits personalizados utilizando mi armario

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Aprovechar mis prendas disponibles para crear nuevas combinaciones |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Motor de outfits que combina prendas del armario según paleta, Style DNA, ocasión, clima y presupuesto, con puntuación y explicación.

## Cómo funciona

1. La usuaria elige la ocasión.
2. El motor arma varias propuestas con prendas de su armario y las puntúa.
3. Puede guardarlas y valorarlas (HU-018).

## Implementación

**Endpoints**

- `POST /api/outfits/generate`
- `CRUD /api/outfits`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/outfits/outfit.engine.ts`
- `backend/src/modules/outfits/outfits.service.ts`

**Tablas**

`outfit`, `outfit_prenda`, `outfit_item`

## Pruebas y criterios de aceptación

- Jest `outfits.spec.ts`.

## Qué falta o limitaciones

- Si el armario está vacío, solo hay sugerencias genéricas.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-015-generar-outfits/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
