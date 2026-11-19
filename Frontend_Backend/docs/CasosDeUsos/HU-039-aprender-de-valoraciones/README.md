# HU-039: Aprender de las valoraciones y elecciones de la usuaria

> En el tablero v2 es **HU-23 · Ajustar las recomendaciones según mis valoraciones** (depende de HU-22).

| Campo | Valor |
|---|---|
| Rol | Sistema |
| Prioridad | Alta |
| Razón (PDF) | Mejorar progresivamente la personalización de las recomendaciones |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 18/11/2026 |

## Criterios de aceptación (HU-23)

| Criterio | Cómo se cumple |
|---|---|
| Las prendas y combinaciones valoradas negativamente aparecen con menor frecuencia | La misma combinación (o una con sus mismas prendas principales) no se vuelve a proponer en Generar outfit y baja al final en Combinaciones. Sus prendas restan puntos, así que salen menos, pero no se excluyen. |
| Las características valoradas positivamente se priorizan en nuevas propuestas | Suben las prendas que agradaron y también los **colores** y **tipos de prenda** que agradaron, incluso en prendas aún sin valorar. El estilo (Style DNA) aprende de las mismas valoraciones. En Combinaciones se marca «Priorizada por tus valoraciones» con el porqué. |

## Cómo funciona

1. **Perfil de gustos** (`feedback-profile.ts`, función pura). Reúne:
   - prendas valoradas solas (`retroalimentacion`, tipo `prenda`): peso 1;
   - combinaciones guardadas y valoradas (`outfit.valoracion`, HU-22) y combinaciones valoradas sin guardar (`retroalimentacion` con `atributos.itemIds`): peso 0,5 para cada una de sus prendas. Si la misma combinación aparece varias veces cuenta una sola, con la valoración guardada.
2. **Afinidades de -1 a 1:**
   - por prenda (suma acotada);
   - por color y por tipo: suma / (evidencias + 1), para no exagerar con pocas valoraciones;
   - afinidad de una prenda = 0,6 × la suya + 0,25 × su color + 0,15 × su tipo.
3. **Motor de outfits `outfits-1.3.0`:**
   - la afinidad entra en la puntuación de cada prenda (±0,1) y en la del conjunto (±0,12);
   - nuevo criterio «Tus valoraciones» en el desglose, solo si ya hay valoraciones, con su explicación («Incluye prendas que te agradaron: Falda negra.»);
   - una combinación que no agradó se descarta.
4. **Combinaciones del armario** (`GET /api/wardrobe/outfits`):
   - además de lo que manda el teléfono, aplica el perfil de la cuenta: ±20 en el orden y -30 si es la misma combinación que no agradó;
   - el motivo de la propuesta dice por qué se priorizó.
5. **Style DNA:** si la valoración trae solo las prendas (`atributos.itemIds`), el estilo a aprender se deduce de ellas.

## Implementación

**Endpoints**

- `POST /api/style/feedback` (nuevo atributo opcional `itemIds`: UUID, máximo 12)
- `POST /api/outfits/generate`, `GET /api/wardrobe/outfits` (usan el perfil)
- `POST/PATCH /api/outfits` (valoración de las guardadas, HU-22)

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/outfits/feedback-profile.ts`
- `backend/src/modules/outfits/outfit.engine.ts`, `outfits.service.ts` (`buildContext`, `feedbackProfile`)
- `backend/src/modules/wardrobe/outfit-generator.service.ts`
- `backend/src/modules/style/style.service.ts`, `style.dto.ts`

**Tablas**

`retroalimentacion`, `outfit`, `outfit_item`, `perfil_dna`, `perfil_dna_historial`. No hay cambio de esquema.

## Pruebas

- Jest `outfits.spec.ts`, bloque «Ajustar las recomendaciones según mis valoraciones (HU-23)»: pesos, duplicados, rasgos en prendas sin valorar, combinación que no agradó descartada y sus prendas menos usadas, prioridad y explicación, y reconocer la combinación aunque la guardada tenga calzado.
- Jest `outfit-generator.spec.ts`: en Combinaciones la que no agradó queda al final y la que agradó sube, priorizada y con el porqué.
- En vivo: los dos generadores responden con el perfil (versión `outfits-1.3.0`) sin errores. La cuenta demo no tiene prendas confirmadas.

## Qué falta o limitaciones

- Es aprendizaje por reglas y pesos, no un modelo entrenado.
- Las valoraciones no pierden peso con el tiempo.
- El teléfono sigue mandando sus propias valoraciones locales (para funcionar sin conexión). Una combinación valorada en el teléfono y en la cuenta se ajusta por los dos lados.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-039-aprender-de-valoraciones/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
