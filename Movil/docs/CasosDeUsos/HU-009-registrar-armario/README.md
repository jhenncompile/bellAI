# HU-009: Registrar y organizar mi armario digital mediante fotografías (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Alta de prendas con cámara o galería, mejora de la imagen tipo estudio, borrador automático si falla la subida y edición posterior.

## Pantallas

- Armario (`src/app/(tabs)/wardrobe.tsx` → `WardrobeScreen`)
- Vistas `CU18GarmentCameraView`, `CU19ConfirmGarmentView`

## Archivos (relativos a `Movil/`)

- `src/screens/WardrobeScreen.tsx`
- `src/views/CU18GarmentCameraView.tsx`
- `src/views/CU19ConfirmGarmentView.tsx`
- `src/features/digital-wardrobe/services/wardrobeService.ts`
- `src/shared/api/xhrUpload.ts`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/wardrobe/mobile-config`
- `POST /api/wardrobe/scan`
- `POST /api/wardrobe/drafts`
- `PATCH /api/wardrobe/:id/photo`
- `PATCH/DELETE /api/wardrobe/:id`

## Qué se probó

- Emulador: alta de prendas; la subida usa XMLHttpRequest porque el `fetch` de Expo SDK 58 no acepta FormData con `{uri}`.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-009-registrar-armario/README.md).

[← Volver al índice](../README.md)
