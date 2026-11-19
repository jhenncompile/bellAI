# HU-004: Analizar mi tono y subtono de piel

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Identificar las características cromáticas necesarias para personalizar mi imagen |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Colorimetría en CIELAB sobre regiones de piel segmentadas: tono, subtono (cálido/frío/neutro), contraste y estación entre 12.

## Cómo funciona

1. Se segmenta la piel (selfie_multiclass) y se excluyen ojos, labios y cabello.
2. Se corrige la iluminación y se pasa a CIELAB.
3. Se estima el subtono con b*/a*, el contraste piel–cabello–ojos y la estación (p. ej. «Primavera Clara»).

## Implementación

**Endpoints**

- `POST /api/diagnosis`
- Servicio de IA: `POST /api/v1/analysis/colorimetry`
- Servicio de IA: `POST /api/v1/analysis/face` (incluye colorimetría)

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/ai/app/analyzers/color.py`
- `backend/ai/app/analyzers/palettes.py`

**Tablas**

`diagnostico`

## Pruebas y criterios de aceptación

- pytest `test_analysis.py`.
- Plan de pruebas CP-035-05: con el retrato de prueba devuelve «Primavera Clara (Light Spring)».

## Qué falta o limitaciones

- La luz ambiente influye: por eso la validación rechaza luz lateral fuerte.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-004-tono-y-subtono-de-piel/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
