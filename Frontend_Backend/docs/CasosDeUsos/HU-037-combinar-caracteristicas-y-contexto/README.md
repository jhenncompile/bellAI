# HU-037: Combinar características visuales, preferencias y contexto para generar recomendaciones

| Campo | Valor |
|---|---|
| Rol | Sistema |
| Prioridad | Alta |
| Razón (PDF) | Personalizar las sugerencias considerando las diferentes variables disponibles |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

`buildContext` reúne paleta, preferencias, Style DNA, clima y valoraciones en un contexto común para el motor de recomendaciones y el de outfits.

## Cómo funciona

1. Cada petición arma el contexto y lo pasa a motores puros y deterministas.

## Implementación

**Endpoints**

- `GET /api/style/recommendations`
- `POST /api/outfits/generate`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/outfits/outfits.service.ts`
- `backend/src/modules/style/recommendation.engine.ts`

## Pruebas y criterios de aceptación

- Jest `style.spec.ts` y `outfits.spec.ts`.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: no aplica (historia de administración o de sistema sin pantalla propia).
- Panel web: no aplica.

[← Volver al índice](../README.md)
