# HU-014: Obtener recomendaciones explicadas (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Cada sugerencia trae factor, valor y regla aplicada; el asistente local puede explicarla en lenguaje natural (HU-042).

## Pantallas

- `StyleScreen`

## Archivos (relativos a `Movil/`)

- `src/features/bellai/ui/components.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/style/recommendations`
- `POST /api/assistant/explain`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-014-recomendaciones-explicadas/README.md).

[← Volver al índice](../README.md)
