# HU-029: Gestionar mis datos y preferencias de privacidad

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Mantener el control sobre mis fotografías, análisis e información personal |
| Planificación | Sprint 1 |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Consentimientos (análisis de fotos, retención), consulta y exportación de todos los datos, y derecho al olvido confirmado con contraseña.

## Cómo funciona

1. La usuaria activa o desactiva el consentimiento de análisis de fotos; sin él, `POST /api/diagnosis` responde 403.
2. En «Mis datos» ve el inventario completo (cuenta, análisis, fotos, prendas) y puede exportarlo en JSON.
3. Para borrar la cuenta escribe su contraseña; si es incorrecta responde 401 y no se borra nada.
4. Con la contraseña correcta se eliminan cuenta, perfil, preferencias, armario, diagnósticos y archivos, y se cierra la sesión.

## Implementación

**Endpoints**

- `GET/POST /api/privacy/consents`
- `GET /api/privacy/data-summary`
- `GET /api/privacy/export`
- `POST /api/privacy/right-to-be-forgotten` (`{confirm, password}`)
- `GET /api/privacy/audit-logs`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/privacy/privacy.service.ts`
- `backend/src/modules/privacy/dto/confirm-data-deletion.dto.ts`

**Panel web**

- Frontend/src/features/privacy/pages/PrivacyPage.tsx y components/ForgetMeDialog.tsx (pide la contraseña).

**Tablas**

`gdpr_consents`, `consentimiento_fotografia`, `audit_logs`, `todas` las tablas con datos de la usuaria (borrado en cascada)

## Pruebas y criterios de aceptación

- CP-029-01 Sin autorización no se analizan fotos: **OK**
- CP-029-02 Consulta de mis datos: **OK**
- CP-029-03 Contraseña incorrecta no borra nada (401) y con la correcta quedan 0 filas: **OK**
- CP-029-04 Cancelar la confirmación no borra nada: el diálogo de web y móvil no envía la petición si se cancela (comprobado a mano, no está en el script).

Los casos CP se ejecutan con `backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py` (sistema levantado con `docker compose up -d`).

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-029-privacidad-de-datos/README.md).
- Panel web: sí.

[← Volver al índice](../README.md)
