# HU-012: Recibir recomendaciones de prendas según mi perfil (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Motor de reglas expertas que cruza diagnóstico, preferencias, Style DNA, ocasión y valoraciones previas.

## Pantallas

- Style DNA / recomendaciones (`StyleScreen`)

## Archivos (relativos a `Movil/`)

- `src/screens/StyleScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/style/recommendations?occasion=`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-012-recomendaciones-de-prendas/README.md).

[← Volver al índice](../README.md)
