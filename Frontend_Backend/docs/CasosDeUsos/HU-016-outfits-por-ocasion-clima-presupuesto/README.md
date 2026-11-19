# HU-016: Solicitar outfits según ocasión, clima, preferencias y presupuesto

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Obtener combinaciones adecuadas para diferentes situaciones y condiciones |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

El pedido de outfits acepta ocasión, coordenadas (clima de Open-Meteo) y presupuesto.

## Cómo funciona

1. La app envía la ubicación (con permiso) y el backend consulta el clima con coordenadas redondeadas.
2. El motor penaliza prendas inadecuadas para la temperatura o lluvia y respeta el presupuesto.

## Implementación

**Endpoints**

- `POST /api/outfits/generate`
- `GET /api/weather?lat=&lon=`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/outfits/outfit.engine.ts`
- `backend/src/modules/weather/weather.service.ts`

## Pruebas y criterios de aceptación

- Jest `outfits.spec.ts`.

## Qué falta o limitaciones

- Sin conexión a Internet no hay clima; el motor sigue sin ese factor.

## Notificación «outfit del día» (18/11/2026)

Criterios de aceptación:

- Cada mañana a las 8:00 llega «Tu outfit de hoy». Al tocarlo se abre Outfits (`/outfits`), que propone la combinación con el clima del momento.
- Es local: la programa el teléfono (`expo-notifications`, aviso diario) y no necesita backend. El texto es genérico porque una notificación programada no puede consultar el clima de la mañana.
- Se activa o desactiva en Perfil → Preferencias → «Notificaciones», junto con el aviso de análisis terminado (HU-005). El permiso se pide una vez por instalación. Al cerrar sesión se cancela.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-016-outfits-por-ocasion-clima-presupuesto/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
