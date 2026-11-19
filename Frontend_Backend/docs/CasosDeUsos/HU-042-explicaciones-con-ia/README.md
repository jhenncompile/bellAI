# HU-042: Generar explicaciones comprensibles a partir de los resultados de IA

| Campo | Valor |
|---|---|
| Rol | Sistema |
| Prioridad | Media |
| Razón (PDF) | Presentar las decisiones y recomendaciones de BellAI de forma entendible para la usuaria |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

`POST /api/assistant/explain` transforma un resultado estructurado (diagnóstico, recomendación, outfit) en una explicación en lenguaje natural con el LLM local.

## Cómo funciona

1. La app envía el resultado; el backend arma el prompt y devuelve la explicación.

## Implementación

**Endpoints**

- `POST /api/assistant/explain`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/assistant/assistant.controller.ts`
- `backend/src/modules/assistant/llm.service.ts`

## Pruebas y criterios de aceptación

- Emulador.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-042-explicaciones-con-ia/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
