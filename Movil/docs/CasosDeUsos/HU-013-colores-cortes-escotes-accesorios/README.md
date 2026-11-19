# HU-013: Recibir recomendaciones de colores, cortes, escotes y accesorios (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> El mismo motor genera sugerencias por categoría: color, corte, escote, accesorio, gafas.

## Pantallas

- `StyleScreen`

## Archivos (relativos a `Movil/`)

- `src/screens/StyleScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/style/recommendations`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-013-colores-cortes-escotes-accesorios/README.md).

[← Volver al índice](../README.md)
