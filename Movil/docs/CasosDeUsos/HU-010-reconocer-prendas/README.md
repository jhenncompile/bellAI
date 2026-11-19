# HU-010: Reconocer automáticamente las características de mis prendas (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> CLIP zero-shot (MobileCLIP2-S0, local) para categoría, patrón y estilo, y color dominante en CIELAB.

## Pantallas

- Confirmación de prenda (`CU19ConfirmGarmentView`)

## Archivos (relativos a `Movil/`)

- `src/views/CU19ConfirmGarmentView.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/wardrobe/scan`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-010-reconocer-prendas/README.md).

[← Volver al índice](../README.md)
