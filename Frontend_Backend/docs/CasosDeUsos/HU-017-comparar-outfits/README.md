# HU-017: Comparar diferentes propuestas de outfit

> En el tablero v2 es **HU-21 · Comparar varias propuestas de combinación de forma simultánea** (depende de HU-19).

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Elegir entre varias alternativas antes de tomar una decisión |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 18/11/2026 |

## Criterios de aceptación (HU-21)

| Criterio | Cómo se cumple |
|---|---|
| Seleccionar al menos dos combinaciones para compararlas | Casilla «Comparar» en cada propuesta; el botón aparece con 2 marcadas (máximo 3 en la app, 4 en la API). |
| La comparación muestra las prendas y el motivo de cada propuesta | Una columna por opción con sus prendas (foto o color, rol y nombre), «Por qué» (puntos fuertes), avisos (puntos débiles) y los criterios en los que gana. |

## Cómo funciona

1. La usuaria marca dos o más propuestas, en **Generar outfit** o en **Armario → Combinaciones** (HU-19).
2. `POST /api/outfits/compare` puntúa todas con el mismo contexto (ocasión y clima) y `summarizeComparison` devuelve:
   - por opción: `strengths` (criterios ≥ 75/100), `weaknesses` (< 50/100) y `winsIn` (criterios que gana con una diferencia de 15 puntos o más);
   - `winner` con `summary`: «Combinación 1 es la más conveniente: gana en colorimetría y ocasión.» Si las puntuaciones totales difieren menos de 2 puntos, `tie: true` y se dice que están parejas en lugar de forzar una ganadora;
   - `comparison`: puntuación de cada opción por criterio, con `leader` cuando uno gana con claridad.
3. Sin conexión (o si una prenda aún no está sincronizada), Combinaciones compara igual las prendas y el motivo de cada una, sin puntuación, y lo avisa.

## Implementación

**Endpoints**

- `POST /api/outfits/compare` (respuesta compatible con la anterior: solo se añadieron campos).

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/outfits/outfit.engine.ts` (`summarizeComparison`)
- `backend/src/modules/outfits/outfits.service.ts`

## Pruebas

- Jest `outfits.spec.ts`, bloque «Comparar varias combinaciones a la vez (HU-21)»: ganadora y en qué gana, motivo de una opción que no destaca, empate y diferencias pequeñas que no deciden.

## Qué falta o limitaciones

- No se probó en vivo con la cuenta demo: no tiene prendas confirmadas.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-017-comparar-outfits/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
