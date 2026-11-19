# HU-005: Consultar mi diagnóstico integral de imagen

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Obtener una visión conjunta de mis características faciales, corporales y colorimétricas |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Un único diagnóstico con resumen, puntuación de confianza y recomendaciones combinadas.

## Cómo funciona

1. Al terminar la tarea de análisis, `diagnosis.builder.ts` integra rostro, color y cuerpo.
2. Se guarda con su confianza y se puede consultar el último o el historial.

## Implementación

**Endpoints**

- `GET /api/diagnosis/latest`
- `GET /api/diagnosis`
- `GET/DELETE /api/diagnosis/:id`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/diagnosis/diagnosis.builder.ts`
- `backend/src/modules/diagnosis/diagnosis.service.ts`

**Tablas**

`diagnostico`

## Pruebas y criterios de aceptación

- Jest: `diagnosis.builder` es una función pura con pruebas.
- Plan de pruebas CP-035-05 (**OK**).

## Qué falta o limitaciones

- Nada pendiente detectado.

## Notificación «análisis terminado» (18/11/2026)

Criterios de aceptación:

- Si la usuaria sale de la app mientras se analiza la foto, le llega un aviso al terminar: «Tu diagnóstico está listo. Eres Otoño cálido…», o el motivo si falló. Al tocarlo se abre el Estudio (`/studio`).
- Lo envía el servidor por push al terminar la tarea (`TasksService.onFinished` → `NotificationsService`). En Android va directo por Firebase (FCM v1) con la cuenta de servicio de `FIREBASE_SERVICE_ACCOUNT_PATH`; los tokens de Expo, si algún día se usa EAS, van por el servicio de Expo. La app necesita `google-services.json` en la raíz de `Movil/` al compilar (`app.config.js` lo incluye si existe). Si el teléfono no tiene push (Expo Go o compilación sin ese archivo), la app muestra un aviso local cuando el análisis termina con la app en segundo plano. Esto solo funciona en Android mientras el sistema no la congele.
- Con la app abierta no sale el banner: la pantalla ya muestra el resultado.
- Se desactiva en Perfil → Preferencias → «Notificaciones» (`preferences.pushNotifications`). Con el interruptor apagado, el servidor no envía nada.
- Privacidad: a Firebase (Google) solo viajan el título y el texto del aviso. Nunca fotos, nombre ni correo.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-005-diagnostico-integral/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
