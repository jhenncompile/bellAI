# HU-018: Guardar y valorar outfits recomendados (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 18/11/2026 · En el tablero v2: **HU-22**

> Cada combinación se guarda, se marca como favorita (estrella) y se valora como agradable, neutral o no agradable. Las guardadas se consultan en «Mis combinaciones».

## Pantallas

- `CU22OutfitCombinationsView` (Armario → Combinaciones, HU-19): valoración de tres niveles, «Guardar» y estrella en cada combinación, y enlace «Mis combinaciones guardadas». Al abrirse carga las ya guardadas para mostrarlas como «Guardada», con su favorita y su valoración, aunque se hayan regenerado.
- `OutfitsScreen` (Generar outfit): las mismas tres valoraciones (antes solo dos), estrella y enlace a las guardadas. Al guardar se envía la valoración que ya tenía.
- `SavedOutfitsScreen` (ruta `/saved-outfits`, nueva):
  - lista con filtros Todas / Favoritas / Agradable / Neutral / No agradable, con su número;
  - en cada una: favorita, valoración (tocar la misma la quita), «Ver en mi avatar» y «Eliminar» con confirmación.
  - También se abre desde Perfil → «Mis combinaciones».
- Controles compartidos en `features/bellai/ui/OutfitRatingControls.tsx` (`FavoriteButton`, `RatingBar`). `RatingBar` reutiliza `FeedbackBar`, que ahora acepta `labels` para que el lector de pantalla diga «Agradable» o «No agradable».

## Archivos (relativos a `Movil/`)

- `src/screens/SavedOutfitsScreen.tsx`, `src/app/saved-outfits.tsx`
- `src/views/CU22OutfitCombinationsView.tsx`, `src/screens/OutfitsScreen.tsx`
- `src/screens/WardrobeScreen.tsx` (cierra el modal de combinaciones antes de abrir las guardadas)
- `src/views/CU04LogoutView.tsx`, `src/screens/ProfileScreen.tsx` (fila «Mis combinaciones»)
- `src/features/bellai/ui/OutfitRatingControls.tsx`, `src/features/bellai/model/outfitRating.ts`
- `src/features/bellai/api/bellaiApi.ts`, `src/features/bellai/api/types.ts`

## Endpoints que usa

- `POST /api/outfits`, `GET /api/outfits`, `PATCH /api/outfits/:id`, `DELETE /api/outfits/:id`
- `POST /api/style/feedback` (Generar outfit)

## HU-23

En Combinaciones, «agradable» y «no agradable» se siguen recordando en el teléfono (`AuraMemoryService`) para reordenar las próximas propuestas. «Neutral» no cambia nada ahí.

## Qué se probó

- `tsc` y eslint limpios. Pendiente probarlo en el dispositivo con un armario que tenga prendas confirmadas.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-018-guardar-y-valorar-outfits/README.md).

[← Volver al índice](../README.md)
