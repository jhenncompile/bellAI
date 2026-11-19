# HU-008: Consultar mi Style DNA (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Visualización del Style DNA en radar, con el origen de cada dato (declarado, diagnóstico, valoraciones).

## Pantallas

- Style DNA (`StyleScreen`)

## Archivos (relativos a `Movil/`)

- `src/screens/StyleScreen.tsx`
- `src/features/bellai/ui/components.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/style/dna`

## Qué se probó

- Emulador (se corrigieron el tamaño del radar y el texto «CláSico»).

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-008-style-dna/README.md).

[← Volver al índice](../README.md)
