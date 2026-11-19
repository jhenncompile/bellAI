# HU-035: Validar las condiciones de las fotografías antes de realizar análisis

| Campo | Valor |
|---|---|
| Rol | Sistema |
| Prioridad | Alta |
| Razón (PDF) | Evitar resultados incorrectos causados por problemas de iluminación, orientación, distancia, visibilidad o postura |
| Planificación | Sprint 1 |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Validador previo: formato, resolución, brillo, sobreexposición, nitidez, distancia, orientación, inclinación, luz lateral y cuerpo completo, con un mensaje de recomendación para cada problema. Todos los umbrales de foto, incluida la luz lateral, se ajustan desde Configuración del panel.

## Cómo funciona

1. La app envía la foto a `/api/diagnosis/validate` (o directamente al diagnóstico, que valida antes de analizar).
2. Los umbrales se configuran desde el panel (HU-030) y se envían al servicio de IA.
3. Si algo falla se devuelve `valid:false` con la lista de problemas y un mensaje en español; no se analiza.

## Implementación

**Endpoints**

- `POST /api/diagnosis/validate`
- Servicio de IA: `POST /api/v1/analysis/validate`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/ai/app/analyzers/quality.py`
- `backend/src/modules/diagnosis/diagnosis.controller.ts`
- `backend/src/modules/admin/settings/settings.service.ts`

**Panel web**

- Frontend/src/features/settings (umbrales de foto editables).

**Tablas**

`platform_settings`

## Pruebas y criterios de aceptación

- CP-035-01 PDF rechazado: **OK**
- CP-035-02 100×100 px → resolución insuficiente: **OK**
- CP-035-03 Foto oscura con recomendación: **OK**
- CP-035-04 Cuerpo recortado: **OK** (en el PDF figuraba como Pendiente)
- CP-035-05 Foto válida → análisis completo: **OK**
- Galaxy S22 (15/11/2026): foto real rechazada por luz lateral (31 > 28) con el mensaje correcto.

Los casos CP se ejecutan con `backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py` (sistema levantado con `docker compose up -d`).

## Qué falta o limitaciones

- Los umbrales vienen de pruebas con pocas fotos reales; conviene calibrarlos con fotos tomadas desde la app (el límite de luz lateral, 28, rechazó una foto real con diferencia de 31).

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-035-validar-fotografias/README.md).
- Panel web: sí.

[← Volver al índice](../README.md)
