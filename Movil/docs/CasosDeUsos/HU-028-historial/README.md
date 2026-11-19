# HU-028: Consultar mi historial de recomendaciones, simulaciones y elecciones (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Historial unificado de diagnósticos, valoraciones, outfits y simulaciones.

## Pantallas

- Historial (`src/app/history.tsx` → `HistoryScreen`)

## Archivos (relativos a `Movil/`)

- `src/screens/HistoryScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/style/history`
- `GET /api/diagnosis`
- `GET /api/simulations`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-028-historial/README.md).

[← Volver al índice](../README.md)
