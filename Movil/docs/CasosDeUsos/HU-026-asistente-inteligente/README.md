# HU-026: Consultar al asistente inteligente sobre moda, imagen y estilo (móvil)

**Estado en móvil:** 🟢 Completa · Revisado el 15/11/2026

> Chat con LLM local (Ollama, `qwen2.5:3b`) con respuesta en streaming (SSE), contexto del diagnóstico y del armario, e historial persistente. Si el LLM está apagado responde con reglas.

## Pantallas

- Asistente (`src/app/(tabs)/advisor.tsx` → `ChatAdvisorScreen`)

## Archivos (relativos a `Movil/`)

- `src/screens/ChatAdvisorScreen.tsx`
- `src/features/chat-advisor/api/advisorService.ts`
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (con el token de `SecureStore`).

## Endpoints que usa

- `/api/assistant/conversations[...]`
- `.../messages/stream`
- `GET /api/assistant/status`

## Qué se probó

- Emulador.

## Qué falta

- Nada pendiente detectado.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-026-asistente-inteligente/README.md).

[← Volver al índice](../README.md)
