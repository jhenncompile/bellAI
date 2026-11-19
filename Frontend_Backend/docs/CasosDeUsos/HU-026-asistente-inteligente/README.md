# HU-026: Consultar al asistente inteligente sobre moda, imagen y estilo

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Obtener orientación personalizada para resolver dudas relacionadas con mi apariencia |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 18/11/2026 |

## Situación actual

Chat con **Kimi** (API de Moonshot, `kimi-k3.1-pro` por defecto) o con un modelo local de **Ollama** si no hay clave de Kimi. Respuesta completa o en streaming (SSE) e historial persistente. Si el modelo no responde, contesta con reglas usando los datos reales del perfil.

## Cómo funciona

1. La usuaria escribe. El backend detecta el **tema** de la pregunta (colores, cabello, maquillaje, rostro, silueta, outfit, compras, estilo); una continuación como «¿y si llueve?» hereda el tema del mensaje anterior.
2. El prompt lleva solo:
   - un **resumen fijo** corto: estación y 5 colores, colores que no quiere usar (siempre), estilo, cuántas prendas tiene y qué análisis le faltan;
   - las **secciones del perfil de ese tema** y nada más;
   - el **historial recortado**: hasta 8 mensajes, 600 caracteres por mensaje y 3500 en total.
3. Si necesita más, el modelo lo **pide al backend con herramientas**, que devuelven JSON compacto sin ids, URLs ni fotos:
   - `consultar_perfil(seccion)`;
   - `buscar_prendas(categoria, color, texto, ocasion, limite)`: si un filtro secundario deja la búsqueda vacía, se quita y se avisa;
   - `proponer_outfits(ocasion, temperatura_c, lluvia, cantidad)`: combinaciones reales del motor de outfits;
   - `consultar_combinaciones_guardadas(solo_favoritas)`.
   Como mucho 3 rondas de 4 llamadas; después tiene que responder.
4. La conversación queda guardada. La respuesta indica `engine` (`kimi`, `llm_local` o `reglas`) y `toolsUsed`.

### Configuración

- `KIMI_API_KEY` en `backend/.env` (y opcionalmente `KIMI_BASE_URL`, por defecto `https://api.moonshot.ai/v1`). Hay que reiniciar la API al cambiarla.
- En el panel, Ajustes → IA:
  - «Proveedor del asistente»: `kimi` u `ollama`;
  - «Modelo de Kimi»;
  - «Razonamiento de Kimi»: `low` por defecto. Los K3 siempre razonan, y `low` es lo más rápido y barato;
  - «Modelo local (Ollama)».
- Los K3 tienen la temperatura fija: no se envía. En cada ronda con herramientas se devuelve a Kimi su `reasoning_content`, como exige su API.

### Privacidad

Con Kimi, el resumen de estilo de la usuaria y los datos que pida el modelo (colores, rasgos del diagnóstico, nombres de prendas) se envían a Moonshot. **Nunca** se envían fotos, nombre, correo ni identificadores. Con el proveedor `ollama`, nada sale del servidor.

## Implementación

**Endpoints**

- `/api/assistant/conversations[...]`
- `.../messages/stream` (SSE)
- `GET /api/assistant/status`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/assistant/assistant.service.ts` (mensajes y ejecutor de herramientas)
- `backend/src/modules/assistant/assistant.context.ts` (temas, resumen, secciones, herramientas, recortes)
- `backend/src/modules/assistant/assistant.prompts.ts` (prompt del sistema y respaldo por reglas)
- `backend/src/modules/assistant/llm.service.ts` y `llm.protocol.ts` (Kimi / Ollama por el protocolo compatible con OpenAI)

**Panel web**

- El modelo y el interruptor del asistente se configuran en Frontend/src/features/settings.

**Tablas**

`conversacion`, `mensaje`

## Pruebas y criterios de aceptación

- Jest `assistant.spec.ts` (18 casos): temas, resumen corto, secciones por tema, búsqueda de prendas, recortes, protocolo de stream y bucle de herramientas contra una API de Kimi simulada (razonamiento devuelto, sin temperatura en K3, ronda final sin herramientas, respaldo a Ollama sin clave).
- En vivo (18/11/2026) con `llama3.1:8b` por el mismo protocolo y una cuenta temporal con 6 prendas, ya borrada. En cada pregunta el modelo pidió solo la herramienta que hacía falta:
  - «qué me pongo para una entrevista» → `proponer_outfits`;
  - «qué corte me queda» → `consultar_perfil`;
  - «¿tengo algo gris?» → `buscar_prendas`.
  La prueba destapó dos fallos que quedaron corregidos: un filtro de ocasión añadido por el modelo le hacía negar una prenda que existía, y `lluvia: "True"` llegaba como texto y se ignoraba.
- Kimi en vivo: pendiente de la clave.

## Qué falta o limitaciones

- Con Ollama en CPU, una respuesta con outfits tarda de 15 a 25 s, y el modelo de 8B se alarga más de lo que pide el prompt.
- La app no muestra todavía `toolsUsed` (por ejemplo, «consultó tu armario»).

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-026-asistente-inteligente/README.md).
- Panel web: sí.

[← Volver al índice](../README.md)
