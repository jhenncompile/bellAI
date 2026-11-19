# HU-006: Consultar mi paleta personalizada de colores (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Cada una de las 12 estaciones tiene su paleta: recomendados, neutros, acentos y colores a evitar.

## Pantallas

- Mi análisis
- Inicio (círculos de color)

## Archivos (relativos a `Movil/`)

- `src/screens/StudioScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `Incluida en GET /api/diagnosis/latest`

## Qué se probó

- Emulador.

## Qué falta

- `CU14PersonalPaletteView` existe pero no está conectada.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-006-paleta-personalizada/README.md).

[← Volver al índice](../README.md)
