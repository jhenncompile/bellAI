# HU-016: Solicitar outfits según ocasión, clima, preferencias y presupuesto (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> El pedido de outfits acepta ocasión, coordenadas (clima de Open-Meteo) y presupuesto.

## Pantallas

- `OutfitsScreen`

## Archivos (relativos a `Movil/`)

- `src/screens/OutfitsScreen.tsx`
- `src/features/bellai/model/location.ts`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/outfits/generate`
- `GET /api/weather?lat=&lon=`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-016-outfits-por-ocasion-clima-presupuesto/README.md).

[← Volver al índice](../README.md)
