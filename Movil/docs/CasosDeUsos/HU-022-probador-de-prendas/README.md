# HU-022: Utilizar un probador virtual de prendas y outfits (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Dos formas de probar: una prenda del armario sobre la foto de la usuaria (2D, guiada por el Pose Landmarker) y outfits completos sobre el avatar 3D (HU-023).

## Pantallas

- Probador virtual → «Prendas» (`SimulatorScreen`)
- Avatar 3D (`AvatarScreen`)

## Archivos (relativos a `Movil/`)

- `src/screens/SimulatorScreen.tsx`
- `src/screens/AvatarScreen.tsx`
- `src/features/bellai/ui/avatarBuilder.ts`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/simulations/options`
- `POST /api/simulations`
- `GET /api/avatar/outfit/:id`

## Qué se probó

- Compila y pasa el lint; falta probarlo en el teléfono con una foto real.

## Qué falta

- Prueba en el teléfono con una prenda real del armario.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-022-probador-de-prendas/README.md).

[← Volver al índice](../README.md)
