# HU-041: Procesar las tareas de visión artificial y renderizado 3D de forma asíncrona (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Cola BullMQ sobre Redis (con modo en memoria si no hay Redis), tabla `tarea` con estado y progreso, reintento manual y concurrencia configurable.

## Pantallas

- Transversal (diagnóstico y simulaciones)

## Archivos (relativos a `Movil/`)

- `src/features/bellai/model/useTask.ts`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `GET /api/tasks/:id`
- `POST /api/tasks/:id/retry`
- `GET /api/tasks/stats`

## Qué se probó

- Emulador y Galaxy S22.

## Qué falta

- Sin notificación push al terminar.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-041-tareas-asincronas/README.md).

[← Volver al índice](../README.md)
