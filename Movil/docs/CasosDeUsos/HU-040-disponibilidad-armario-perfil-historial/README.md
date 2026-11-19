# HU-040: Mantener disponible el armario, perfil e historial (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Persistencia en PostgreSQL con volúmenes Docker y `restart: always`; sincronización y caché sin conexión del armario en el móvil; copias de seguridad restaurables.

## Pantallas

- Armario (caché sin conexión)
- Historial del armario

## Archivos (relativos a `Movil/`)

- `src/features/digital-wardrobe/storage/offlineSyncStorage.ts`
- `src/features/digital-wardrobe/screens/WardrobeHistoryScreen.tsx`
- `src/features/digital-wardrobe/components/WarmSwitchTile.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/wardrobe/sync`
- `PATCH /api/wardrobe/sync/settings`
- `GET /api/wardrobe/history`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-040-disponibilidad-armario-perfil-historial/README.md).

[← Volver al índice](../README.md)
