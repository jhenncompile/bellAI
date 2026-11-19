# HU-024: Evaluar una prenda mediante la cámara

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Conocer rápidamente la compatibilidad de una prenda con mi perfil y armario |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

«¿Me lo compro?»: foto de una prenda en tienda → semáforo verde/amarillo/rojo según paleta, estilo y combinaciones con el armario. La foto no se guarda.

## Cómo funciona

1. La usuaria fotografía la prenda.
2. Se clasifica con CLIP y se mide su color.
3. El motor de compatibilidad devuelve nivel, puntuación y motivos.

## Implementación

**Endpoints**

- `POST /api/compatibility` (`file`)
- Servicio de IA: `POST /api/v1/analysis/garment`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/compatibility/compatibility.engine.ts`
- `backend/src/modules/compatibility/compatibility.module.ts`

## Pruebas y criterios de aceptación

- Jest `outfits.spec.ts` (semáforo).

## Qué falta o limitaciones

- No se ha probado con una prenda real desde el teléfono.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-024-evaluar-prenda-con-camara/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
