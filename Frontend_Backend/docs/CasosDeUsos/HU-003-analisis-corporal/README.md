# HU-003: Analizar mis proporciones corporales mediante fotografías

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Obtener información sobre mis proporciones para personalizar recomendaciones de prendas, cortes y largos |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟡 Parcial** |
| Revisado | 15/11/2026 |

## Situación actual

MediaPipe Pose Landmarker y el segmentador de silueta miden hombros, cintura, cadera y verticalidad, y asignan un tipo de silueta con recomendaciones de líneas y largos.

## Cómo funciona

1. La foto de cuerpo entero debe mostrar de la cabeza a los pies (la validación lo exige).
2. Se obtienen los puntos del cuerpo y el contorno, y se calculan las relaciones hombro/cadera y cintura/cadera.
3. Se asigna la silueta (reloj de arena, triángulo, triángulo invertido, rectángulo, óvalo) con su confianza.
4. El diagnóstico integra la silueta con el rostro y el color (HU-036).

## Implementación

**Endpoints**

- `POST /api/diagnosis` (`body`)
- Servicio de IA: `POST /api/v1/analysis/body`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/ai/app/analyzers/body.py`
- `backend/ai/app/analyzers/registry.py`

**Tablas**

`diagnostico`

## Pruebas y criterios de aceptación

- pytest unitario de proporciones.
- pytest `test_tryon.py`: con ropa holgada (caftán) baja la confianza y se avisa.
- pytest `test_tryon.py`: análisis sobre una foto real de cuerpo entero (dominio público, `fixtures/cuerpo_completo.jpg`) → «Triángulo / Pera» con medidas coherentes.
- CP-035-04: una foto recortada se rechaza con «Debe verse tu cuerpo completo» (**OK**).

## Qué falta o limitaciones

- Falta una foto real que además pase la validación (la de prueba posa con un brazo levantado y se rechaza por postura, lo cual es correcto).
- Ropa holgada: si la silueta en la cadera supera 2,3 veces la distancia entre las articulaciones de la cadera (`LOOSE_HIP_RATIO`), la confianza baja a 0,6 como máximo y se avisa a la usuaria. El umbral es una heurística sin calibrar con fotos de la app. Los puntos clave salen del modelo MediaPipe Pose `full` si está descargado (más preciso que `lite`, que queda como respaldo).
- Los umbrales de silueta están sin calibrar con varias fotos reales.

## Plataformas

- Móvil: **🟡 Parcial** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-003-analisis-corporal/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
