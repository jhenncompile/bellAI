# HU-029: Gestionar mis datos y preferencias de privacidad (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Consentimientos (análisis de fotos, retención), consulta y exportación de todos los datos, y derecho al olvido confirmado con contraseña.

## Pantallas

- Perfil → Privacidad (`CU11PrivacyDataView`)

## Archivos (relativos a `Movil/`)

- `src/views/CU11PrivacyDataView.tsx`
- `src/features/privacy/api/privacyService.ts`
- `src/screens/ProfileScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET/POST /api/privacy/consents`
- `GET /api/privacy/data-summary`
- `GET /api/privacy/export`
- `POST /api/privacy/right-to-be-forgotten`
- `GET /api/privacy/audit-logs`

## Qué se probó

- Emulador: interruptor de retención de fotos y pantalla de datos.

## Qué falta

- La vista `CU08PhotoConsentView` existe pero no está conectada; el consentimiento se gestiona desde `CU11`.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-029-privacidad-de-datos/README.md).

[← Volver al índice](../README.md)
