# HU-035: Validar las condiciones de las fotografías antes de realizar análisis (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Validador previo: formato, resolución, brillo, sobreexposición, nitidez, distancia, orientación, inclinación, luz lateral y cuerpo completo, con un mensaje de recomendación para cada problema. Todos los umbrales de foto, incluida la luz lateral, se ajustan desde Configuración del panel.

## Pantallas

- Cámara guiada (guía de ojos y barbilla, consejos de luz)
- Alerta «Revisemos la foto»

## Archivos (relativos a `Movil/`)

- `src/widgets/GuidedCamera/ui/GuidedCameraModal.tsx`
- `src/features/scan-diagnosis/model/useScanWorkflow.ts`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/diagnosis/validate`

## Qué se probó

- Emulador (foto oscura) y Galaxy S22 (luz lateral).

## Qué falta

- `CU09GuidedCameraView` y `CU10PhotoQualityValidationView` existen pero no están conectadas; se usa `GuidedCameraModal`.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-035-validar-fotografias/README.md).

[← Volver al índice](../README.md)
