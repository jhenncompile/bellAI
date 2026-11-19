# HU-009: Registrar y organizar mi armario digital mediante fotografías

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Crear y mantener un inventario visual de mis prendas, calzado y accesorios |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Alta de prendas con cámara o galería, mejora de la imagen tipo estudio, borrador automático si falla la subida y edición posterior.

## Cómo funciona

1. La usuaria toma la foto de la prenda.
2. El backend la mejora (fondo y luz), la clasifica (HU-010) y crea la prenda.
3. Si la subida falla se guarda un borrador que se completa luego.

## Implementación

**Endpoints**

- `GET /api/wardrobe/mobile-config`
- `POST /api/wardrobe/scan`
- `POST /api/wardrobe/drafts`
- `PATCH /api/wardrobe/:id/photo`
- `PATCH/DELETE /api/wardrobe/:id`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/wardrobe/wardrobe.service.ts`
- `backend/src/modules/wardrobe/wardrobe.controller.ts`
- `backend/src/modules/wardrobe/wardrobe-enhancement.service.ts`

**Tablas**

`wardrobe_items`, `audit_logs` (historial del armario)

## Pruebas y criterios de aceptación

- `node --test backend/tests/wardrobe.test.js` (7/7).
- Plan de pruebas: alta de prenda en CP-034-03.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-009-registrar-armario/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
