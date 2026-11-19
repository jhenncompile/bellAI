# HU-013: Recibir recomendaciones de colores, cortes, escotes y accesorios

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Seleccionar elementos que sean coherentes con mi perfil de imagen y estilo |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

El mismo motor genera sugerencias por categoría: color, corte, escote, accesorio, gafas.

## Cómo funciona

1. Las reglas usan la forma del rostro (escotes, gafas), la silueta (cortes, largos) y la estación (colores).

## Implementación

**Endpoints**

- `GET /api/style/recommendations`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/style/recommendation.engine.ts`

## Pruebas y criterios de aceptación

- Jest `style.spec.ts`.

## Qué falta o limitaciones

- Sin foto de cuerpo, las reglas de corte y largo son genéricas.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-013-colores-cortes-escotes-accesorios/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
