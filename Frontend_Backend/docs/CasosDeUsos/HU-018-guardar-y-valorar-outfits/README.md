# HU-018: Guardar y valorar outfits recomendados

> En el tablero v2 es **HU-22 · Guardar y valorar las combinaciones propuestas** (depende de HU-19, la necesita HU-23).

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Media |
| Razón (PDF) | Conservar combinaciones de interés y proporcionar información sobre mis preferencias |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 18/11/2026 |

## Criterios de aceptación (HU-22)

| Criterio | Cómo se cumple |
|---|---|
| Marcar una combinación como favorita | `favorite` al guardar (`POST /api/outfits`) o después (`PATCH /api/outfits/:id`). Una favorita siempre queda guardada (restricción `NOT favorito OR guardado`). |
| Valorar cada combinación como agradable, neutral o no agradable | `rating` al guardar o con `PATCH /api/outfits/:id` (`null` la quita). Se guarda en `outfit.valoracion`. |
| Consultar las guardadas más tarde | `GET /api/outfits`, con las favoritas primero; filtros `?favorites=true` y `?rating=agradable\|neutral\|no_agradable`. |

## Cómo funciona

1. **Sin duplicados:** guardar una combinación con las mismas prendas que una ya guardada no crea otra. Se actualiza la existente (favorita o valoración) y se responde `alreadySaved: true`. La comparación se hace por el conjunto de prendas (`itemSetKey`, sin importar el orden), y el orden de `uuid` en PostgreSQL se comprobó igual al de la clave.
2. **La valoración aprende (HU-23):** pasa por `StyleService.feedback` con el vector de estilo de las prendas. Así ajusta el Style DNA y queda en `retroalimentacion`. Repetir la misma valoración no vuelve a aprender; quitarla borra su fila de `retroalimentacion`.
3. **Validación:** un valor de `rating` no válido responde 400 «La valoración debe ser agradable, neutral o no agradable.».

## Implementación

**Endpoints**

- `POST /api/outfits` (`favorite`, `rating`; responde `alreadySaved`)
- `GET /api/outfits?favorites=&rating=`
- `PATCH /api/outfits/:id` (`title`, `favorite`, `rating`)
- `DELETE /api/outfits/:id`, `POST /api/outfits/:id/wear`
- `POST/GET /api/style/feedback`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/outfits/outfit-ratings.ts` (valoraciones, equivalencia con el feedback e `itemSetKey`)
- `backend/src/modules/outfits/outfits.service.ts` (`save`, `findSaved`, `applyRating`, `list`)
- `backend/src/modules/outfits/outfits.controller.ts`, `outfits.dto.ts`
- `backend/src/modules/style/style.service.ts`

**Tablas**

`outfit`, `outfit_item`, `retroalimentacion`. No hay cambio de esquema: las columnas `favorito` y `valoracion` ya existían.

## Pruebas

- Jest `outfits.spec.ts`, bloque «Guardar y valorar combinaciones (HU-22)»: clave del conjunto (orden, mayúsculas y repetidas) y equivalencia de valoraciones.
- En vivo con la cuenta demo: los filtros de `GET /api/outfits` responden y el valor no válido da 400. No se creó ninguna combinación (la cuenta no tiene prendas confirmadas).

## Qué falta o limitaciones

- Quitar una valoración no deshace lo que el Style DNA ya aprendió de ella.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-018-guardar-y-valorar-outfits/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
