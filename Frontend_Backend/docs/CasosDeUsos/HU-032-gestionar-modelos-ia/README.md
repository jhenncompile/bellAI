# HU-032: Gestionar los modelos de inteligencia artificial

| Campo | Valor |
|---|---|
| Rol | Administrador |
| Prioridad | Alta |
| Razón (PDF) | Mantener actualizados los componentes utilizados para análisis, visión y recomendaciones |
| Planificación | Sprint 1 |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Registro de modelos con versión y descripción, sincronización con los analizadores del servicio de IA, comprobación de compatibilidad antes de activar, activar/desactivar sin afectar a los demás, y subida del archivo del modelo con validación de formato.

## Cómo funciona

1. El administrador registra una versión o sincroniza las existentes.
2. Antes de activar se comprueba contra el servicio de IA; si falla se mantiene la versión activa (422).
3. Puede subir el archivo del modelo; formatos no admitidos → «Formato de modelo no válido».

## Implementación

**Endpoints**

- `GET/POST /api/admin/ai-models`
- `POST /api/admin/ai-models/sync`
- `POST /api/admin/ai-models/:id/check|activate|deactivate`
- `POST /api/admin/ai-models/:id/artifact`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/ai-models/ai-models.service.ts`
- `backend/src/modules/ai-models/ai-models.controller.ts`
- `backend/ai/app/api/v1/endpoints/models.py`

**Panel web**

- Frontend/src/features/ai-models/pages/AiModelsPage.tsx (incluye el botón de subir archivo).

**Tablas**

`modelo_ia`, `media_assets`

## Pruebas y criterios de aceptación

- CP-032-01 Registrar v1.0 visible: **OK**
- CP-032-02 Desactivar sin afectar a los demás: **OK**
- CP-032-03 Restaurar versión anterior con comprobación: **OK**
- CP-032-04 Formato no soportado: **OK**

Los casos CP se ejecutan con `backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py` (sistema levantado con `docker compose up -d`).

## Qué falta o limitaciones

- Subir el archivo guarda y vincula el artefacto, pero el servicio de IA no carga pesos subidos en caliente: los modelos en uso son los de `MODELS_DIR`.

## Plataformas

- Móvil: no aplica (historia de administración o de sistema sin pantalla propia).
- Panel web: sí.

[← Volver al índice](../README.md)
