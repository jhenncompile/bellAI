# HU-034: Procesar y proteger localmente la información sensible

| Campo | Valor |
|---|---|
| Rol | Sistema |
| Prioridad | Alta |
| Razón (PDF) | Reducir los riesgos asociados al tratamiento de fotografías, características personales y resultados de IA |
| Planificación | Sprint 1 |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Contraseñas con bcrypt, datos personales cifrados, fotos privadas que no se sirven, URLs firmadas para las fotos del armario, redirección a HTTPS y procesamiento de IA en local.

## Cómo funciona

1. Las contraseñas se guardan como hash bcrypt; teléfono y dirección con AES-256-GCM.
2. Las fotos de análisis van a `uploads/private/...` y esa ruta responde 404.
3. Las fotos del armario solo se sirven con URL firmada (HMAC-SHA256, 24 h); sin firma responde 403.
4. Con `FORCE_HTTPS=true` y `x-forwarded-proto: http` se redirige con 301 a HTTPS.
5. El análisis (MediaPipe, CLIP) y el LLM (Ollama) corren en local; ninguna foto sale a servicios externos.

## Implementación

**Endpoints**

- (transversal) middleware en `backend/src/main.ts`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/common/media/signed-url.ts`
- `backend/src/main.ts`
- `backend/src/modules/wardrobe/wardrobe.service.ts`
- `backend/src/modules/assistant/assistant.prompts.ts`
- `backend/ai/app/main.py`

**Tablas**

`users.password` (hash), `profiles` (cifrado)

## Pruebas y criterios de aceptación

- CP-034-01 Contraseña guardada como hash: **OK**
- CP-034-02 Redirección a HTTPS: implementada en `main.ts`; se activa con `FORCE_HTTPS=true` detrás de un proxy TLS (no está en el script automático).
- CP-034-03 Fotos solo accesibles por su dueña (firmada 200, sin firma 403, otra usuaria 404): **OK**
- CP-034-04 Los logs no contienen contraseñas ni tokens: **OK**

Los casos CP se ejecutan con `backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py` (sistema levantado con `docker compose up -d`).

## Qué falta o limitaciones

- En local no hay certificado TLS: HTTPS depende del proxy del despliegue.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-034-proteger-informacion-sensible/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
