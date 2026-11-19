# HU-025: Consultar el nivel y motivo de compatibilidad de una prenda (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Cada resultado del semáforo lista los factores (color frente a paleta, estilo frente a Style DNA, prendas del armario con las que combina).

## Pantallas

- `CompatibilityScreen`

## Archivos (relativos a `Movil/`)

- `src/screens/CompatibilityScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/compatibility`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-025-motivo-de-compatibilidad/README.md).

[← Volver al índice](../README.md)
