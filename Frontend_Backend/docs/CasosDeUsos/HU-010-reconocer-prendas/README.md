# HU-010: Reconocer automáticamente las características de mis prendas

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Evitar registrar manualmente información como categoría, color, patrón y estilo |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

CLIP zero-shot (MobileCLIP2-S0, local) para categoría, patrón y estilo, y color dominante en CIELAB.

## Cómo funciona

1. La foto de la prenda llega al servicio de IA.
2. CLIP compara con etiquetas en texto y devuelve la más probable con su confianza.
3. La usuaria confirma o corrige antes de guardar.

## Implementación

**Endpoints**

- Servicio de IA: `POST /api/v1/analysis/garment`
- `POST /api/wardrobe/scan`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/ai/app/analyzers/garment.py`
- `backend/ai/app/models/vision.py`

**Tablas**

`wardrobe_items`

## Pruebas y criterios de aceptación

- pytest `test_vision_model.py`.

## Qué falta o limitaciones

- Requiere los pesos de CLIP descargados (`download_models.py --with-clip`).

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-010-reconocer-prendas/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
