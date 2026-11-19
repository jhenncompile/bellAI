# HU-004: Analizar mi tono y subtono de piel (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Colorimetría en CIELAB sobre regiones de piel segmentadas: tono, subtono (cálido/frío/neutro), contraste y estación entre 12.

## Pantallas

- Mi análisis
- Tarjeta «Tu análisis» en Inicio

## Archivos (relativos a `Movil/`)

- `src/screens/StudioScreen.tsx`
- `src/screens/HomeScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/diagnosis`

## Qué se probó

- Emulador: se muestra la estación, el subtono y el contraste.

## Qué falta

- `CU13SkinToneView` existe pero no está conectada.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-004-tono-y-subtono-de-piel/README.md).

[← Volver al índice](../README.md)
