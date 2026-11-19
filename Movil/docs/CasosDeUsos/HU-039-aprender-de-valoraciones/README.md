# HU-039: Aprender de las valoraciones y elecciones de la usuaria (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 18/11/2026 · En el tablero v2: **HU-23**

> Lo que valora (agradable, neutral, no agradable) queda en su cuenta con las prendas de la combinación. Las próximas propuestas suben lo que agradó (prendas, colores, tipos) y bajan lo que no.

## Pantallas

- `CU22OutfitCombinationsView` (Armario → Combinaciones):
  - **sin guardar:** la valoración se manda a la cuenta con sus prendas (`targetId` = `comboFeedbackId`, un hash corto y estable de la combinación) y además se recuerda en el teléfono (`AuraMemoryService`) para funcionar sin conexión;
  - **guardada:** se valora con `PATCH /api/outfits/:id` (HU-22);
  - las propuestas priorizadas dicen por qué en su motivo («Priorizada por tus valoraciones. Incluye prendas que te agradaron: …»).
- `OutfitsScreen` (Generar outfit): la valoración se manda con las prendas (`itemIds`) además del vector de estilo. El desglose «¿Por qué?» muestra el criterio «Tus valoraciones».
- `StyleScreen`: valoración de recomendaciones (Style DNA), sin cambios.

## Archivos (relativos a `Movil/`)

- `src/views/CU22OutfitCombinationsView.tsx`, `src/screens/OutfitsScreen.tsx`
- `src/features/bellai/model/outfitRating.ts` (`comboFeedbackId`)
- `src/features/bellai/ui/components.tsx`, `src/features/bellai/api/bellaiApi.ts`

## Endpoints que usa

- `POST /api/style/feedback`, `PATCH /api/outfits/:id`
- `GET /api/wardrobe/outfits`, `POST /api/outfits/generate` (ya ordenan según las valoraciones de la cuenta)

## Qué se probó

- `tsc` y eslint limpios. Pendiente probarlo en el dispositivo con un armario que tenga prendas confirmadas.

## Qué falta

- Al reabrir Combinaciones, la valoración de una combinación sin guardar se recupera del teléfono solo si fue agradable o no agradable; «neutral» no se muestra de nuevo (sí cuenta en la cuenta).

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-039-aprender-de-valoraciones/README.md).

[← Volver al índice](../README.md)
