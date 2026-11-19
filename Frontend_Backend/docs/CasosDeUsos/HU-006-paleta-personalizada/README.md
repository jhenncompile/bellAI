# HU-006: Consultar mi paleta personalizada de colores

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Identificar colores recomendados, neutros y de acento para mi imagen |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Cada una de las 12 estaciones tiene su paleta: recomendados, neutros, acentos y colores a evitar.

## Cómo funciona

1. La estación del diagnóstico selecciona la paleta en `palettes.py`.
2. La app muestra muestras de color con su nombre.

## Implementación

**Endpoints**

- `Incluida en GET /api/diagnosis/latest`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/ai/app/analyzers/palettes.py`
- `backend/ai/app/analyzers/color.py`

**Tablas**

`diagnostico` (JSON de paleta)

## Pruebas y criterios de aceptación

- pytest de paletas y emulador.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-006-paleta-personalizada/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
