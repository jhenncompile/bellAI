# HU-011: Consultar las prendas disponibles en mi armario (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Cuadrícula con búsqueda y filtros combinables, detalle con fechas de alta y último uso, y registro de uso.

## Pantallas

- Armario (`CU20WardrobeView`)
- Detalle (`CU21GarmentDetailView`)

## Archivos (relativos a `Movil/`)

- `src/views/CU20WardrobeView.tsx`
- `src/views/CU21GarmentDetailView.tsx`
- `src/features/digital-wardrobe/components/EmptyWardrobeState.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/wardrobe`
- `GET /api/wardrobe/:id`
- `POST /api/wardrobe/:id/wear`

## Qué se probó

- Emulador: listado, estado vacío y detalle.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-011-consultar-armario/README.md).

[← Volver al índice](../README.md)
