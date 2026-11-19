# Backend BellAI (NestJS)

API principal de BellAI: autenticación, perfil y privacidad, armario digital, diagnóstico morfológico,
Style DNA y recomendaciones, outfits, semáforo de compatibilidad, simulaciones, avatar 3D, asistente con
LLM local, incidencias y administración de modelos de IA. La lista de endpoints está en `../AGENTS.md`
y la documentación interactiva en **`/api/docs`** (Swagger).

## Arranque

```bash
docker compose up -d postgres redis ollama   # desde la raíz del repo
cp .env.example .env                         # ajusta DB_*, JWT_SECRET, ENCRYPTION_KEY
npm install
npm run dev                                  # http://localhost:8000/api
```

Necesita el servicio de IA en `AI_SERVICE_URL` (ver `ai/README.md`) para diagnósticos, prendas,
semáforo y simulaciones. Sin `REDIS_HOST` las tareas de IA se procesan en memoria (solo desarrollo).

## Arquitectura

| Pieza | Dónde | Qué hace |
|---|---|---|
| Gateway de IA | `src/modules/ai-gateway` | Único cliente HTTP hacia FastAPI: URL, clave interna, tiempos y errores (HU-043) |
| Tareas | `src/modules/tasks` | BullMQ + tabla `tarea`: estado, progreso, reintento, sin duplicados (HU-041) |
| Diagnóstico | `src/modules/diagnosis` | Validación de fotos, análisis asíncrono, diagnóstico integral (HU-002 a HU-006, 035, 036) |
| Estilo | `src/modules/style` | Style DNA, motor de reglas explicadas y aprendizaje por valoraciones (HU-007/008, 012–014, 018, 039) |
| Outfits y clima | `src/modules/outfits`, `src/modules/weather` | Generación por ocasión, clima (Open-Meteo) y presupuesto; comparación (HU-015–017, 038) |
| Semáforo | `src/modules/compatibility` | Verde/amarillo/rojo con motivos y combinaciones con el armario (HU-024/025/027) |
| Asistente | `src/modules/assistant` | Ollama local, contexto mínimo sin fotos, SSE, explicaciones (HU-026/027/042) |
| Simulaciones y avatar | `src/modules/simulations` | Cabello, maquillaje, uñas, gafas; configuración del avatar procedural (HU-019–023) |
| Modelos de IA | `src/modules/ai-models` | Versiones por entorno, comprobación antes de activar, conserva la anterior si falla (HU-032) |
| Incidencias | `src/modules/incidents` | Reportes de usuarias y atención desde el panel (HU-031) |

Los motores (`*.engine.ts`, `style-dna.ts`, `diagnosis.builder.ts`) son funciones puras y se prueban sin base de datos.

## Esquema

`schema.sql` es la fuente de verdad (lo carga Docker al crear la base). Cada cambio va también en una
migración en `src/migrations/` (se ejecutan al arrancar; `synchronize` está en `false`).

## Pruebas

```bash
npm test             # Jest (motores)
npm run test:cov     # con cobertura mínima del 80 %
npm run test:wardrobe
```

## Privacidad

- Las fotos de análisis se guardan en `private/{usuario}/photos`; `/uploads/private` nunca se sirve.
- Por defecto se borran al terminar el análisis; solo se conservan con el consentimiento `photo_retention`.
- El derecho al olvido borra la cuenta, todas las tablas de BellAI (en cascada) y los archivos.
- Las coordenadas para el clima se redondean a un decimal antes de consultar Open-Meteo.
