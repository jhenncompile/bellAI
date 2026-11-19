# HU-002: Analizar las características de mi rostro mediante fotografías

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Obtener información sobre mi forma y características faciales para personalizar las recomendaciones |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

MediaPipe Face Landmarker obtiene 478 puntos del rostro; se calculan proporciones, forma facial aproximada y un nivel de confianza.

## Cómo funciona

1. La foto pasa primero la validación de calidad (HU-035).
2. El servicio de IA extrae los landmarks y mide largo/ancho, frente, pómulos y mandíbula.
3. Clasifica la forma (ovalado, redondo, cuadrado, corazón, alargado, diamante) con su confianza y los parámetros usados.
4. El resultado se guarda en el diagnóstico y alimenta recomendaciones de gafas, cortes y escotes.

## Implementación

**Endpoints**

- `POST /api/diagnosis` (`face`) → 202 tarea
- Servicio de IA: `POST /api/v1/analysis/face`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/ai/app/analyzers/face.py`
- `backend/ai/app/api/v1/endpoints/analysis.py`
- `backend/src/modules/diagnosis/diagnosis.service.ts`

**Tablas**

`diagnostico`, `fotografia`, `tarea`

## Pruebas y criterios de aceptación

- pytest `backend/ai/tests/test_analysis.py` con la foto de prueba `fixtures/retrato.jpg`.
- CP-035-05 del plan de pruebas: foto válida → análisis completo (**OK**).

## Qué falta o limitaciones

- Falta un diagnóstico completo con una foto real desde el teléfono: la del 15/11/2026 se rechazó por luz lateral (31 frente al límite de 28).

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-002-analisis-facial/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
