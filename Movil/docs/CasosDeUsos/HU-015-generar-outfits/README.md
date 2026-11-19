# HU-015: Generar outfits personalizados utilizando mi armario (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Motor de outfits que combina prendas del armario según paleta, Style DNA, ocasión, clima y presupuesto, con puntuación y explicación.

## Pantallas

- Outfits (`src/app/outfits.tsx` → `OutfitsScreen`)

## Archivos (relativos a `Movil/`)

- `src/screens/OutfitsScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/outfits/generate`
- `CRUD /api/outfits`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-015-generar-outfits/README.md).

[← Volver al índice](../README.md)
