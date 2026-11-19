# HU-017: Comparar diferentes propuestas de outfit (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 18/11/2026 · En el tablero v2: **HU-21**

> Se marcan dos o tres combinaciones y se ven lado a lado: prendas, motivo de cada una, cuál conviene más y por qué.

## Pantallas

- `OutfitsScreen` (Generar outfit): casilla «Comparar» en cada propuesta.
- `CU22OutfitCombinationsView` (Armario → Combinaciones, HU-19): casilla «Comparar» en cada combinación. Si cambian la ocasión, la temporada o se regenera, la selección se descarta.
- Ambas usan el widget `OutfitComparison`: una columna por opción (prendas, «Por qué», avisos, «Gana en»), la conclusión y la puntuación por criterio.

## Archivos (relativos a `Movil/`)

- `src/widgets/OutfitComparison/ui/OutfitComparison.tsx`
- `src/screens/OutfitsScreen.tsx`
- `src/views/CU22OutfitCombinationsView.tsx`
- `src/features/bellai/api/types.ts` (`CompareResponse`)

## Endpoints que usa

- `POST /api/outfits/compare`

## Qué se probó

- `tsc` y eslint limpios. Pendiente probarlo en el dispositivo con un armario que tenga prendas confirmadas.

## Qué falta

- Sin conexión, Combinaciones compara sin puntuación (prendas y motivo de cada una).

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-017-comparar-outfits/README.md).

[← Volver al índice](../README.md)
