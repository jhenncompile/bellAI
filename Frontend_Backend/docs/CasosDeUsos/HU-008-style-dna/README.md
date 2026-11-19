# HU-008: Consultar mi Style DNA

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Media |
| Razón (PDF) | Conocer las dimensiones de estilo que representan mis preferencias |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Visualización del Style DNA en radar, con el origen de cada dato (declarado, diagnóstico, valoraciones).

## Cómo funciona

1. La app pide `GET /api/style/dna` y dibuja el radar de 7 ejes.

## Implementación

**Endpoints**

- `GET /api/style/dna`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/style/style-dna.ts`
- `backend/src/modules/style/style.controller.ts`

## Pruebas y criterios de aceptación

- Jest `style.spec.ts`.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-008-style-dna/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
