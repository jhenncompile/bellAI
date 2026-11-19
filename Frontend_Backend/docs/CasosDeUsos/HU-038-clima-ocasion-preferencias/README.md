# HU-038: Incorporar clima, ocasión y preferencias al generar outfits

| Campo | Valor |
|---|---|
| Rol | Sistema |
| Prioridad | Alta |
| Razón (PDF) | Garantizar que las propuestas sean coherentes con el contexto de uso |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Clima de Open-Meteo (sin clave, coordenadas redondeadas a 2 decimales por privacidad) más ocasión y preferencias.

## Cómo funciona

1. La app pide permiso de ubicación.
2. El backend consulta el clima y lo pasa al motor de outfits.

## Implementación

**Endpoints**

- `GET /api/weather`
- `POST /api/outfits/generate`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/weather/weather.service.ts`
- `backend/src/modules/outfits/outfit.engine.ts`

## Pruebas y criterios de aceptación

- Jest `outfits.spec.ts`.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-038-clima-ocasion-preferencias/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
