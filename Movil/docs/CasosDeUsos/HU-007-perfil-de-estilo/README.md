# HU-007: Obtener un perfil de estilo personalizado (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 18/11/2026 · Backlog v2: **HU-13 Conocer mi perfil de estilo**

> Perfil de estilo con 7 dimensiones (elegancia, minimalismo, romanticismo, naturalidad, dramatismo, clasicismo, experimentalidad) y los estilos más cercanos.

## Pantallas

- Style DNA (`src/app/style.tsx` → `StyleScreen`)

## Archivos (relativos a `Movil/`)

- `src/screens/StyleScreen.tsx`
- `src/features/bellai/ui/components.tsx` (radar `DnaRadar`)
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/style/dna`

## Qué muestra (HU-13)

- Radar, dimensiones predominantes (barras) y estilos cercanos.
- «Qué forma tu perfil»: porcentaje de cada fuente (preferencias, diagnóstico, armario, valoraciones).
- «Cómo ha cambiado»: dimensiones que subieron o bajaron y los últimos cambios con su motivo. Un momento en que el perfil era neutro se muestra como «Perfil equilibrado, sin un estilo marcado» en lugar de inventar dimensiones predominantes.
- Se vuelve a pedir al entrar en la pantalla, para reflejar el armario y el diagnóstico recientes.
- Sin datos, un estado vacío que lleva a elegir estilos (no se inventan dimensiones).

## Qué se probó

- Emulador: radar y estilos cercanos.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-007-perfil-de-estilo/README.md).

[← Volver al índice](../README.md)
