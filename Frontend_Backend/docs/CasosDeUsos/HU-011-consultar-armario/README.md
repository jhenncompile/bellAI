# HU-011: Consultar las prendas disponibles en mi armario

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Conocer qué prendas, calzado y accesorios tengo disponibles para crear combinaciones |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Cuadrícula con búsqueda y filtros combinables, detalle con fechas de alta y último uso, y registro de uso.

## Cómo funciona

1. La app pide el armario con filtros (categoría, color, temporada, ocasión).
2. Al abrir una prenda se ve su detalle y se puede marcar como usada.

## Implementación

**Endpoints**

- `GET /api/wardrobe`
- `GET /api/wardrobe/:id`
- `POST /api/wardrobe/:id/wear`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/wardrobe/wardrobe.service.ts`
- `backend/src/modules/wardrobe/wardrobe.controller.ts`

**Tablas**

`wardrobe_items`

## Pruebas y criterios de aceptación

- `wardrobe.test.js`.
- CP-040-01/02 del plan de pruebas.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-011-consultar-armario/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
