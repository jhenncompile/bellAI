# HU-025: Consultar el nivel y motivo de compatibilidad de una prenda

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Comprender los factores utilizados para determinar si una prenda es compatible conmigo |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Cada resultado del semáforo lista los factores (color frente a paleta, estilo frente a Style DNA, prendas del armario con las que combina).

## Cómo funciona

1. La respuesta de compatibilidad incluye los motivos y las prendas con las que combina.

## Implementación

**Endpoints**

- `POST /api/compatibility`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/compatibility/compatibility.engine.ts`

## Pruebas y criterios de aceptación

- Jest.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-025-motivo-de-compatibilidad/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
