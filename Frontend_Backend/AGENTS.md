# AGENTS.md — Sistema Bellia

Guía de orientación para agentes y personas que entran por primera vez a este repositorio.

- Este archivo explica **qué es el proyecto y en qué estado está**.
- Las **reglas** que hay que seguir están en **[`.rules/`](./.rules/README.md)**, separadas por tema.
- Si trabajas dentro de `Frontend/`, lee además **[`Frontend/AGENTS.md`](./Frontend/AGENTS.md)** (arquitectura en detalle).

Cada asistente carga las reglas por su propio archivo de enganche, y todos apuntan a `.rules/`: `CLAUDE.md` (Claude Code), `.cursor/rules/*.mdc` (Cursor), `.agents/rules/*.md` (Antigravity) y este `AGENTS.md` (Codex, Zed, Amp, Jules y otros). Si cambias una regla, cámbiala en `.rules/` y aplica a todos.

---

## 1. Qué es esto

**BellAI** (Grupo 8, Software 1) es un asistente de imagen, moda y belleza: diagnóstico morfológico (rostro, colorimetría, silueta), Style DNA, recomendaciones explicadas que aprenden de las valoraciones, armario digital, outfits por ocasión y clima, semáforo de compatibilidad en tienda, simulador de cabello/maquillaje/uñas/gafas, avatar 3D y asistente con Kimi (API de Moonshot) o un LLM local de respaldo. Este repo contiene la API, el servicio de IA y el panel de administración; la app móvil (Expo/React Native) está en `../Movil`.

> El "Perfil de proyecto" (PDF) menciona Flutter, FastAPI como backend principal y SQLAlchemy. El stack real es Expo/React Native + NestJS/TypeORM + FastAPI solo para IA. Conviene actualizar la sección 3 del PDF.

| Pieza | Carpeta | Stack | Puerto |
|---|---|---|---|
| Panel de administración (SPA) | `Frontend/` | React 19, Vite 6, TypeScript, Tailwind v4, shadcn | `5173` |
| API principal | `backend/` | NestJS 10, TypeORM, JWT, Helmet, Throttler, Sharp | `8000` (prefijo `/api`) |
| Servicio de IA | `backend/ai/` | Python, FastAPI, MediaPipe, OpenCV, CLIP (open_clip), pytest | `8001` local / AWS ECS |
| Asistente (LLM) | — | Kimi por API (`KIMI_API_KEY`); sin clave, Ollama local | `11434` (Ollama) |
| Base de datos | — | PostgreSQL 17 (`bellia`) | `5432` |
| Caché y colas | — | Redis 7 | `6379` |

Todo se orquesta desde `docker-compose.yml` en la raíz.

---

## 2. Cómo arrancarlo

```bash
# Todo el sistema (Postgres, Redis, IA, Ollama, backend y panel)
docker compose up -d
docker compose exec ollama ollama pull llama3:8b-instruct-q4_K_M   # una vez: modelo del asistente

# Desarrollo con hot-reload
docker compose up -d postgres redis ollama
cd backend/ai && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt \
  && .venv/bin/python scripts/download_models.py models --with-clip \
  && .venv/bin/uvicorn app.main:app --port 8001          # http://localhost:8001/docs
cd backend && npm install && npm run dev                  # http://localhost:8000/api  · Swagger en /api/docs
cd Frontend && pnpm install && pnpm dev                   # http://localhost:5173
```

- `iniciar.ps1` y `PROYECTO_CONTROL.cmd` son scripts de arranque **sólo para Windows**; en Linux/macOS usa `docker compose` directamente.
- El esquema de la base se crea desde `backend/schema.sql` (montado como `init.sql` del contenedor de Postgres). `synchronize` de TypeORM está en `false` a propósito: los cambios de esquema van en `backend/schema.sql` y en `backend/src/migrations/`.
- Credenciales de demostración: **`valeria@bellia.com` / `123456789`** (precargadas en el formulario de login).

---

## 3. Mapa del repositorio

```
.
├── AGENTS.md                 # este archivo: qué es el proyecto y su estado real
├── CLAUDE.md                 # enganche para Claude Code -> .rules/
├── .rules/                   # LAS REGLAS (fuente de verdad)
├── .cursor/rules/            # enganche para Cursor -> .rules/
├── .agents/rules/            # enganche para Antigravity -> .rules/
├── docker-compose.yml        # Postgres 17 + Redis 7 + backend + frontend
├── iniciar.ps1               # arranque asistido (Windows)
├── PROYECTO_CONTROL.cmd      # menú de control del proyecto (Windows)
├── .github/workflows/        # CI: backend NestJS (Jest), panel (lint+build), IA (pytest + ECR + ECS)
├── Frontend/                 # SPA React — ver Frontend/AGENTS.md
└── backend/
    ├── schema.sql            # fuente de verdad del esquema
    ├── src/
    │   ├── main.ts           # Helmet, CORS, ValidationPipe, Swagger (/api/docs), /uploads (sin /uploads/private)
    │   ├── app.module.ts     # TypeORM, Cache, Throttler, módulos
    │   ├── migrations/       # migraciones TypeORM (se ejecutan al arrancar)
    │   ├── common/           # guards, decoradores, crypto, color (CIELAB/ΔE)
    │   └── modules/          # auth, users, profile, privacy, media, wardrobe, admin, bellai,
    │                         # ai-gateway, tasks, diagnosis, ai-models, incidents, style,
    │                         # weather, outfits, compatibility, assistant, simulations (+ avatar)
    └── ai/                   # FastAPI: analizadores (calidad, rostro, color, cuerpo, prenda, simulación)
```

## 4. Endpoints de la API (`backend/src/modules/*/\*.controller.ts`)

| Método y ruta | Módulo | Notas |
|---|---|---|
| `POST /api/auth/register` | auth | bcrypt; crea perfil y preferencias por defecto; máx. 10 intentos/min por IP |
| `POST /api/auth/login` | auth | devuelve `{ user, token }`; mismo mensaje si el correo no existe o la contraseña falla; máx. 10 intentos/min por IP |
| `GET /api/auth/me` | auth | requiere JWT |
| `GET /api/usuarios` | users | responde `{ data: [...] }`; filtros `?search=` y `?role=`; sólo rol `admin` (TEC-03, RNF-01) |
| `GET /api/usuarios/:id` | users | sólo rol `admin` (TEC-03) |
| `PATCH /api/usuarios/:id/status` | users | sólo rol `admin` |
| `PATCH /api/usuarios/:id/role` | users | sólo rol `admin` |
| `POST /api/usuarios`, `DELETE /api/usuarios/:id` | users | sólo rol `admin` |
| `GET` / `PUT /api/profile` | profile | datos personales; teléfono y dirección cifrados con AES-256-GCM |
| `POST /api/profile/avatar` | profile | recibe `file`, valida y optimiza la imagen, y actualiza la foto del usuario autenticado |
| `GET` / `PUT /api/profile/preferences` | profile | preferencias de recomendaciones y estilo, más preferencias de cuenta |
| `POST /api/upload/avatar` | upload | Sharp: limpia EXIF y convierte a WebP |
| `GET /api/privacy/data-summary` | privacy | inventario de datos personales, fotografías y prendas de la usuaria |
| `GET /api/privacy/export` | privacy | descarga JSON de perfil, preferencias, armario y enlaces de fotografías (Art. 20 RGPD) |
| `GET` / `POST /api/privacy/consents` | privacy | |
| `POST /api/privacy/right-to-be-forgotten` | privacy | requiere `{ confirm: true }`; elimina cuenta, perfil, preferencias, armario y medios personales |
| `GET /api/privacy/audit-logs` | privacy | |
| `GET /api/media` | media | admin/manager ven todo; una usuaria sólo sus recursos. Responde `{ data, total, page, totalPages }` |
| `GET /api/media/:id` | media | 404 si el recurso no es tuyo (salvo admin/manager) |
| `POST /api/media/upload`, `presigned-upload`, `confirm-upload` | media | HU-033 |
| `GET /api/media/stats/overview`, `GET /api/media/:id/dependencies`, `PATCH /api/media/:id/retire`, `DELETE /api/media/:id` | media | sólo `admin`/`manager` |
| `GET /api/admin/dashboard`, `/admin/dashboard/stats`, `/admin/audit-logs`, `GET`/`PATCH /api/admin/settings` | admin | panel de administración (usuarias activas por `last_seen_at`, servicios comprobados en vivo, espacio de fotos) |
| `GET /api/wardrobe/mobile-config` | wardrobe | configuración de permisos de cámara/galería, categorías, subcategorías y ocasiones para React Native (HU-009, HU-14, HU-16) |
| `POST /api/wardrobe/scan` | wardrobe | escaneo de prenda (cámara/galería), mejora realista tipo estudio, auto-clasificación y borrador automático ante fallos (HU-009) |
| `POST /api/wardrobe/drafts` | wardrobe | guarda borrador de prenda antes o ante fallo de subida de foto (HU-009) |
| `PATCH /api/wardrobe/:id/photo` | wardrobe | adjunta/reintenta subida de foto sobre un borrador y lo confirma (HU-009) |
| `GET /api/wardrobe` | wardrobe | cuadrícula (`grid`), búsqueda y filtros combinables (`category`, `subcategory`, `color`, `season`, `occasion`) de la usuaria autenticada (HU-009, HU-011, HU-16) |
| `GET` / `PATCH` / `DELETE /api/wardrobe/:id` | wardrobe | detalle de prenda con fecha de alta y último uso, edición/confirmación y eliminación privada (HU-009, HU-011) |
| `POST /api/wardrobe/:id/wear` | wardrobe | registra el uso de una prenda (`lastWornAt`, `wearCount`) (HU-011) |
| `GET /api/wardrobe/outfits` | wardrobe | combinaciones sólo con prendas confirmadas: superior + inferior o cuerpo entero, más calzado/abrigo si hay; `?season=` y `?limit=` (1-20). Si faltan prendas responde `isSufficient: false` con lo que falta (HU-19). Pruebas: `npm run build && node --test tests/outfits.test.js` |
| `GET /api/wardrobe/history` | wardrobe | historial de acciones del armario (`agregar`, `editar`, `eliminar`) con fecha (HU-040) |
| `GET /api/wardrobe/sync` | wardrobe | paquete completo de respaldo en la nube y caché sin conexión (cuenta, `lastSyncedAt`, armario e historial) (HU-040) |
| `PATCH /api/wardrobe/sync/settings` | wardrobe | actualiza los interruptores de copia automática (`autoBackupEnabled`) y modo sin conexión (`offlineModeEnabled`) (HU-040) |
| `GET` / `PATCH /api/bellai/photo-consent` | bellai | consulta o actualiza el consentimiento de análisis fotográfico (HU-06) |
| `GET` / `POST /api/bellai/diagnostics` | bellai | lista o guarda diagnósticos biométricos y de colorimetría de la usuaria |
| `GET` / `POST /api/bellai/outfits` | bellai | lista o guarda combinaciones con motivo personalizado (HU-18, HU-26) |
| `POST /api/bellai/recommendations/explain` | bellai | explica el motivo de una recomendación usando colorimetría, rostro, armario y preferencias reales (HU-18) |
| `GET` / `POST /api/bellai/conversations` | bellai | lista o crea sesiones de consulta con la asesora virtual (HU-25) |
| `GET /api/bellai/challenges/active`, `PATCH /api/bellai/challenges/tasks/:taskId` | bellai | HU-28: reto de la semana (se genera del catálogo `weekly-challenges.ts` si no hay uno programado), avance, semanas anteriores y racha; solo se marcan tareas del reto vigente |
| `GET /api/bellai/conversations/:id` | bellai | obtiene el detalle completo de una consulta guardada |
| `POST /api/bellai/conversations/:id/messages` | bellai | envía pregunta a la asesora virtual con contexto 360° y guarda el historial; devuelve `503` si no hay servicio de IA (HU-25) |
| `GET /api/bellai/history` | bellai | historial unificado de diagnósticos, combinaciones y consultas ordenados por fecha (HU-26) |
| `GET` / `DELETE /api/bellai/history/:type/:id` | bellai | abre un elemento del historial sin repetir análisis o lo elimina con registro en `AuditLog` (HU-26) |

**Funciones del PDF (Swagger completo en `/api/docs`):**

| Método y ruta | Módulo | Historias |
|---|---|---|
| `POST /api/diagnosis/validate` | diagnosis | HU-035: valida luz, nitidez, distancia y orientación |
| `POST /api/diagnosis` (`face`, `body`) → 202 tarea | diagnosis | HU-002 a HU-006, HU-036 (asíncrono, HU-041) |
| `GET /api/diagnosis/latest`, `GET /api/diagnosis`, `GET`/`DELETE /api/diagnosis/:id` | diagnosis | HU-005, HU-028, HU-029 |
| `POST /api/vision/analyze-face` | diagnosis | compatibilidad con la app móvil anterior |
| `GET /api/tasks/:id`, `POST /api/tasks/:id/retry`, `GET /api/tasks/stats` (admin) | tasks | HU-041 |
| `GET /api/style/dna`, `GET /api/style/recommendations?occasion=` | style | HU-007/008, HU-012/013/014/037 |
| `POST`/`GET /api/style/feedback`, `GET /api/style/history` | style | HU-018/039, HU-028 |
| `POST /api/outfits/generate`, `POST /api/outfits/compare`, CRUD `/api/outfits`, `POST /api/outfits/:id/wear` | outfits | HU-015/016/017/018 |
| `GET /api/weather?lat=&lon=` | weather | HU-038 (Open-Meteo, coordenadas redondeadas) |
| `POST`/`DELETE /api/notifications/push-token` `{ token, platform }` | notifications | HU-005 / HU-016 (token de Expo del teléfono; avisa al terminar un análisis o una simulación) |
| `POST /api/compatibility` (`file`) | compatibility | HU-024/025/027 (la foto no se guarda) |
| `GET /api/simulations/options`, `POST /api/simulations` → 202, `GET /api/simulations`, `GET /api/simulations/:id/image`, `DELETE` | simulations | HU-019/020/021 |
| `GET`/`POST /api/avatar`, `GET /api/avatar/outfit/:id` | simulations | HU-022/023. La config guarda `preset` (silueta base) y `hairFringe`; `GET` devuelve `recommendation` (silueta sugerida por el análisis) |
| `POST /api/avatar/scan` (multipart), `GET /api/avatar/mesh?garments=tipo:RRGGBB,…` (maniquí MakeHuman vestido; sin prendas, ropa genérica), `DELETE /api/avatar/scan` | simulations | HU-023: escaneo guiado → tarea `avatar_escaneo` → IA `POST /api/v1/avatar/reconstruct`. Las medidas eligen la silueta y los ajustes del maniquí (`configuracion.scan.mannequin`); ya no hay modelo Character Creator |
| `/api/assistant/conversations[...]`, `.../messages/stream` (SSE), `POST /api/assistant/explain`, `GET /api/assistant/status` | assistant | HU-026/027/042 |
| `POST /api/incidents`, `GET /api/incidents/mine` · `GET`/`PATCH /api/admin/incidents[...]` | incidents | HU-031 |
| `GET /api/admin/ai-models`, `POST` (registrar), `/sync`, `/:id/artifact` (archivo del modelo), `/:id/check`, `/:id/activate`, `/:id/deactivate`, `/active` | ai-models | HU-032/033 |
| `GET /api/media/stats/overview` (incluye `usage`: cuota y alerta ≥ 90 %), `POST /api/media/cleanup-orphans?dryRun=` | media | HU-033 (CP-033-01/03/04) |
| `GET`/`PATCH /api/admin/settings[/:key]` (valores tipados) | admin | HU-030 (umbrales de foto, cola, LLM) |
| `GET /api/subscriptions/me`, `POST /api/subscriptions/checkout` (Stripe Checkout, Bs 49 · 30 días), `POST /api/subscriptions/confirm` | subscriptions | HU-34/35: plan Gratis/Premium. Los topes responden **402 `PLAN_LIMIT`** en asistente, simulaciones y armario (HU-36) |
| `POST /api/subscriptions/webhook` (firma `Stripe-Signature`), `GET /api/subscriptions/return` (vuelve a la app) | subscriptions | públicas a propósito |
| `GET /api/admin/payments` | subscriptions | HU-37: pagos, suscriptoras activas e ingresos del mes |

Todas las rutas salvo `register`/`login` (y el webhook y el retorno de pagos, que no llevan sesión) van protegidas por `JwtAuthGuard`, y hay rate limiting global (`ThrottlerGuard`, 120 req/min por defecto).

---

## 5. Estado real del proyecto (verificado, no aspiracional)

Lee esto antes de dar por buena cualquier documentación del repo.

- **La app móvil consume esta API.** El repo `Movil/` (Expo, hermano de `Proyecto/`) usa `auth`, `profile`, `privacy`, `upload` y `wardrobe`. Se configura con `EXPO_PUBLIC_API_URL=<ip-de-tu-pc>:8000` en `Movil/.env`. `/api/vision/*` (bellai, con sesión) reenvía al servicio de IA a través de `AiGatewayService`; si la IA no responde devuelve 503, sin resultados inventados.
- **`POST /api/auth/register` siempre crea rol `user`**; los roles elevados se asignan sólo con `POST /api/usuarios` o `PATCH /api/usuarios/:id/role` (admin).
- **Asistente (LLM):** usa Kimi si hay `KIMI_API_KEY` y el ajuste `llm_provider` es `kimi`; si no, Ollama con el modelo de `llm_model` (comprueba con `ollama list` que el nombre coincide). Al modelo solo le llega un resumen del perfil y lo que pide con herramientas (`assistant.context.ts`); con Kimi esos datos salen hacia Moonshot, nunca fotos, nombre ni correo. Si no responde, contesta con reglas y el panel lo marca «con limitaciones».
- **`Frontend/Dockerfile` usa `npm install`** mientras el desarrollo se hace con `pnpm`. Son dos resoluciones de dependencias distintas.
- **JWT**: no hay secreto de respaldo en el código (`src/config/jwt.config.ts`). Sin `JWT_SECRET`, en producción la API no arranca y en desarrollo usa uno aleatorio (las sesiones caen al reiniciar). `JWT_EXPIRES_IN` (por defecto `7d`) sí se respeta.
- **Secretos y variables de entorno (TEC-06)**: `docker-compose.yml` ya no lleva secretos en claro; se parametrizan mediante variables de entorno (`.env` / `.env.example`). En `app.module.ts` se eliminaron los respaldos inseguros en código y el CORS se cerró con lista blanca configurada vía `CORS_ORIGIN` en NestJS y `CORS_ORIGINS` en el microservicio de IA.
- **Pruebas:** backend NestJS con Jest (`npm test`, motores de estilo, outfits, semáforo, diagnóstico y asistente) y `node --test tests/wardrobe.test.js`; servicio de IA con pytest (≥ 80 % de cobertura, usa una foto de retrato en `ai/tests/fixtures`). El panel web no tiene tests (solo lint + build en CI).
- **El análisis corporal no se ha probado con una foto real de cuerpo completo** (solo con siluetas sintéticas): falta una foto de prueba con permiso de uso.
- **Modelos de IA reales:** ResNet-34 de ImageNet (armario y red siamesa del recomendador), CLIP MobileCLIP2-S0 (prendas), BiSeNet face parsing con ResNet-18 (piel, cabello, gafas y sombrero; también en el teléfono), SegFormer-B2 (ropa puesta, `/vision/analyze-outfit`), MediaPipe (puntos del rostro y del cuerpo, recorte de prendas, probador y maquillaje) y para el asistente Kimi por API o, sin clave, un modelo de Ollama. En `backend/ai/app/models/checkpoints/` solo `resnet34_pretrained.pt` es útil: el U-Net es de tumores cerebrales y los otros tres `.pt` están sin entrenar. No hay VITON-HD ni BeautyGAN. Detalle en `backend/ai/README.md`.
- **Las simulaciones son transformaciones 2D** (recolor por segmentación y landmarks); no hay IA generativa por difusión (requiere GPU). El corte de cabello no se simula, solo color y técnica.
- **El avatar 3D** sale del escaneo guiado (malla con medidas reales armada en `backend/ai/app/analyzers/avatar_scan.py`, sin GLB). Sin escaneo, la app usa el maniquí procedural (`Movil/src/features/bellai/ui/avatarBuilder.ts`). Falta probar el escaneo en un teléfono real.
- **Fotos del armario:** `/uploads/wardrobe/*` solo se sirve con URL firmada (HMAC + caducidad de 24 h, `src/common/media/signed-url.ts`); sin firma responde 403.
- **Derecho al olvido:** exige la contraseña actual (`password` en el cuerpo).
- **Copias de seguridad:** `scripts/backup.sh` y `scripts/restore.sh <copia> [base_de_prueba]`.
- **Estado por historia de usuario:** `docs/CasosDeUsos/README.md` (una carpeta por HU-001…HU-043; lo móvil en `../Movil/docs/CasosDeUsos/`).
- **Prueba de integración** (probador de prendas HU-022 y rutas `/api/bellai` incorporadas desde main): `backend/ai/.venv/bin/python backend/tests/e2e/integracion.py`.
- **Plan de pruebas del PDF:** `backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py` (36 casos CP contra el sistema levantado).
- **Fotos privadas:** se guardan en `private/{usuario}/photos` y `/uploads/private` no se sirve. Por defecto se borran al terminar el análisis; solo se conservan con el consentimiento `photo_retention`.
- **La cola usa BullMQ si `REDIS_HOST` está definido**; sin él procesa en memoria (solo para desarrollo).
- El backend escucha en `0.0.0.0` y el frontend en `host: true` a propósito, para poder probar desde móviles Android en la red local.
- Docker inicializa tablas e índices con `backend/schema.sql`, pero no registra las migraciones de TypeORM como ejecutadas. Las migraciones 1–3 usan `CREATE INDEX IF NOT EXISTS` para poder arrancar sobre esa base sin fallar por índices duplicados.

---

## 6. Cómo trabajamos

Las reglas completas están en [`.rules/`](./.rules/README.md). Lo esencial:

- **Idioma: español** en UI, comentarios, nombres de dominio (`usuarios`, `perfil`) y mensajes de commit. El código en inglés sólo donde ya lo está (nombres técnicos de React/Nest).
- **Ramas por persona** (`Alan`, `valeria`, …) y Pull Request hacia `main`. No commitees ni abras PRs sin que te lo pidan explícitamente.
- Antes de tocar el esquema de la base: `backend/schema.sql` **y** una migración en `backend/src/migrations/`.
- Si cambias un contrato de API, actualiza las dos puntas (`backend/src/modules/...` y el `service` de la feature correspondiente del frontend) en el mismo cambio.
- Las reglas de capas del frontend **no son sólo documentación**: `Frontend/eslint.config.js` las impone con `no-restricted-imports`, así que `pnpm lint` falla si se violan.
