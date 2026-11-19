# HU-038: Incorporar clima, ocasión y preferencias al generar outfits (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Clima de Open-Meteo (sin clave, coordenadas redondeadas a 2 decimales por privacidad) más ocasión y preferencias.

## Pantallas

- `OutfitsScreen`

## Archivos (relativos a `Movil/`)

- `src/features/bellai/model/location.ts`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/weather`
- `POST /api/outfits/generate`

## Qué se probó

- Emulador (ubicación simulada).

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-038-clima-ocasion-preferencias/README.md).

[← Volver al índice](../README.md)
