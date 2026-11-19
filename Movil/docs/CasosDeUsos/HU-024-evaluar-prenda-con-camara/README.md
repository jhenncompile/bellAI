# HU-024: Evaluar una prenda mediante la cámara (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> «¿Me lo compro?»: foto de una prenda en tienda → semáforo verde/amarillo/rojo según paleta, estilo y combinaciones con el armario. La foto no se guarda.

## Pantallas

- ¿Me lo compro? (`src/app/compatibility.tsx` → `CompatibilityScreen`)

## Archivos (relativos a `Movil/`)

- `src/screens/CompatibilityScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/compatibility`

## Qué se probó

- Emulador con imagen de prueba.

## Qué falta

- Prueba con prenda real en el Galaxy S22.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-024-evaluar-prenda-con-camara/README.md).

[← Volver al índice](../README.md)
