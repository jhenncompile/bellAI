# HU-003: Analizar mis proporciones corporales mediante fotografías (móvil)

**Estado en móvil:** 🟡 Parcial · Revisado el 15/11/2026

> MediaPipe Pose Landmarker y el segmentador de silueta miden hombros, cintura, cadera y verticalidad, y asignan un tipo de silueta con recomendaciones de líneas y largos.

## Pantallas

- Cámara guiada, pestaña «Cuerpo»
- Mi análisis

## Archivos (relativos a `Movil/`)

- `src/widgets/GuidedCamera/ui/GuidedCameraModal.tsx`
- `src/features/scan-diagnosis/model/useScanWorkflow.ts`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/diagnosis`

## Qué se probó

- El flujo de captura funciona; falta una foto real de cuerpo entero (a 2–3 m).

## Qué falta

- `CU15SilhouetteView` existe pero no está conectada.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-003-analisis-corporal/README.md).

[← Volver al índice](../README.md)
