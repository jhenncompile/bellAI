# HU-019: Visualizar cambios virtuales de cabello y color (móvil)

**Estado en móvil:** 🟡 Parcial · Revisado el 15/11/2026

> Cambio de color de cabello sobre la foto con segmentación de cabello y mezcla en espacio de color. Corre como tarea asíncrona.

## Pantallas

- Probador virtual (`src/app/simulator.tsx` → `SimulatorScreen`)

## Archivos (relativos a `Movil/`)

- `src/screens/SimulatorScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/simulations/options`
- `POST /api/simulations`
- `GET /api/simulations/:id/image`

## Qué se probó

- Emulador.

## Qué falta

- Sin cambio de corte.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-019-cambios-de-cabello-y-color/README.md).

[← Volver al índice](../README.md)
