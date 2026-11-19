# HU-002: Analizar las características de mi rostro mediante fotografías (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> MediaPipe Face Landmarker obtiene 478 puntos del rostro; se calculan proporciones, forma facial aproximada y un nivel de confianza.

## Pantallas

- Inicio → «Tomar otra fotografía» (cámara guiada, modo Rostro)
- Mi análisis (`src/app/(tabs)/studio.tsx`)

## Archivos (relativos a `Movil/`)

- `src/widgets/GuidedCamera/ui/GuidedCameraModal.tsx`
- `src/features/scan-diagnosis/model/useScanWorkflow.ts`
- `src/screens/StudioScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/diagnosis`

## Qué se probó

- Galaxy S22: captura real, subida y validación con mensaje claro. Falta un análisis completo con buena luz.

## Qué falta

- `CU12FaceShapeView` existe pero no está conectada; la forma del rostro se muestra en `StudioScreen`.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-002-analisis-facial/README.md).

[← Volver al índice](../README.md)
