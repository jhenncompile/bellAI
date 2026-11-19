# HU-031: Gestionar incidencias reportadas por las usuarias (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Las usuarias reportan desde la app; el administrador las ve, prioriza, cambia de estado y responde en el panel. El monitor de almacenamiento también abre incidencias automáticas.

## Pantallas

- Reportar un problema (`src/app/report.tsx` → `ReportScreen`)

## Archivos (relativos a `Movil/`)

- `src/screens/ReportScreen.tsx`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `POST /api/incidents`
- `GET /api/incidents/mine`
- `GET/PATCH /api/admin/incidents[...]`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-031-gestionar-incidencias/README.md).

[← Volver al índice](../README.md)
