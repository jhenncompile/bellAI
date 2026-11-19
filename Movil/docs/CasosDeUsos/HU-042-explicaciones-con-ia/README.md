# HU-042: Generar explicaciones comprensibles a partir de los resultados de IA (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> `POST /api/assistant/explain` transforma un resultado estructurado (diagnóstico, recomendación, outfit) en una explicación en lenguaje natural con el LLM local.

## Pantallas

- Botón «Explícamelo» en las tarjetas

## Archivos (relativos a `Movil/`)

- `src/features/bellai/ui/components.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/assistant/explain`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-042-explicaciones-con-ia/README.md).

[← Volver al índice](../README.md)
