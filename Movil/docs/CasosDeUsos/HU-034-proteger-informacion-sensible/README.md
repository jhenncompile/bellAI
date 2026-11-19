# HU-034: Procesar y proteger localmente la información sensible (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Contraseñas con bcrypt, datos personales cifrados, fotos privadas que no se sirven, URLs firmadas para las fotos del armario, redirección a HTTPS y procesamiento de IA en local.

## Pantallas

- Transversal (sin pantalla propia)

## Archivos (relativos a `Movil/`)

- `src/shared/lib/secureToken.ts` (token en SecureStore)
- `src/screens/ProfileScreen.tsx`
- `src/views/CU11PrivacyDataView.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- Transversal.

## Qué se probó

- Emulador y Galaxy S22: el token se guarda en SecureStore y las imágenes del armario cargan con URL firmada.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-034-proteger-informacion-sensible/README.md).

[← Volver al índice](../README.md)
