# HU-043: Mantener una arquitectura modular para los componentes de IA

| Campo | Valor |
|---|---|
| Rol | Sistema |
| Prioridad | Media |
| Razón (PDF) | Permitir actualizar o sustituir modelos de IA, visión y recomendación sin afectar el resto del sistema |
| Planificación | Sprint 1 |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Servicio de IA aparte (FastAPI) con un registro de analizadores; el backend lo llama por un gateway con timeouts; los motores de estilo y outfits son funciones puras en el backend y funcionan aunque la IA esté caída.

## Cómo funciona

1. Cada analizador se registra en `registry.py` con nombre, versión y contrato.
2. El backend lo consume vía `ai-gateway.service.ts`; Swagger documenta la API en `/api/docs` y FastAPI en `/docs`.

## Implementación

**Endpoints**

- Servicio de IA: `GET /api/v1/models`
- Servicio de IA: `GET /api/v1/models/{name}/check`
- `GET /api/admin/ai-models`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/ai/app/analyzers/registry.py`
- `backend/src/modules/ai-gateway/ai-gateway.service.ts`
- `backend/src/modules/wardrobe/wardrobe-enhancement.service.ts`

**Tablas**

`modelo_ia`

## Pruebas y criterios de aceptación

- CP-043-01 Recomendaciones operan sin el servicio de IA: **OK**
- CP-043-02 Reemplazar un modelo: se hace registrando una versión nueva y activándola (HU-032); no está en el script.
- CP-043-03 Módulos con interfaz documentada: **OK**
- CP-043-04 Pruebas por módulo: Jest 18/18, `wardrobe.test.js` 7/7, pytest 46/46.

Los casos CP se ejecutan con `backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py` (sistema levantado con `docker compose up -d`).

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: no aplica (historia de administración o de sistema sin pantalla propia).
- Panel web: no aplica.

[← Volver al índice](../README.md)
