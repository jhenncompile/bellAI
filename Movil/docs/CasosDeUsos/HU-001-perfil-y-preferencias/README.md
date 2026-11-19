# HU-001: Gestionar mi perfil y preferencias de estilo (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> La usuaria edita sus datos y su foto, y declara estilos, colores (favoritos y evitados), ocasiones y presupuesto. Esas preferencias alimentan el Style DNA, las recomendaciones y los outfits.

## Pantallas

- Perfil (`src/app/(tabs)/profile.tsx` → `src/screens/ProfileScreen.tsx`)
- Vista `CU07ProfilePreferencesView` (preferencias dentro de Perfil)

## Archivos (relativos a `Movil/`)

- `src/screens/ProfileScreen.tsx`
- `src/views/CU07ProfilePreferencesView.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET/PUT /api/profile`
- `POST /api/profile/avatar`
- `GET/PUT /api/profile/preferences`

## Qué se probó

- Emulador: edición de preferencias y contador de prendas del perfil.

## Qué falta

- Las vistas `CU05StylePreferencesView` y `CU06OccasionsBudgetView` existen pero no están conectadas a ninguna ruta; las preferencias se editan desde `CU07`.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-001-perfil-y-preferencias/README.md).

[← Volver al índice](../README.md)
