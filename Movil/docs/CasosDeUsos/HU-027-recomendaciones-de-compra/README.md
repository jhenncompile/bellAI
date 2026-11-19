# HU-027: Consultar recomendaciones relacionadas con compras (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> El semáforo de compatibilidad indica cuántas prendas del armario combinan con la nueva; el asistente responde preguntas de compra con el contexto del armario.

## Pantallas

- `CompatibilityScreen`
- `ChatAdvisorScreen`

## Archivos (relativos a `Movil/`)

- `src/screens/CompatibilityScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/compatibility`
- `/api/assistant/...`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-027-recomendaciones-de-compra/README.md).

[← Volver al índice](../README.md)
