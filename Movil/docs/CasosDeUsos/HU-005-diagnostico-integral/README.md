# HU-005: Consultar mi diagnóstico integral de imagen (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Un único diagnóstico con resumen, puntuación de confianza y recomendaciones combinadas.

## Pantallas

- Mi análisis (`StudioScreen`)

## Archivos (relativos a `Movil/`)

- `src/screens/StudioScreen.tsx`
- `src/features/scan-diagnosis/model/useScanWorkflow.ts`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/diagnosis/latest`
- `GET /api/diagnosis`
- `GET/DELETE /api/diagnosis/:id`

## Qué se probó

- Emulador: diagnóstico restaurado al abrir la app.

## Qué falta

- `CU16DiagnosticSummaryView` y `CU17RetryAnalysisView` existen pero no están conectadas.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-005-diagnostico-integral/README.md).

[← Volver al índice](../README.md)
