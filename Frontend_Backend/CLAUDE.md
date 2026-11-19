# CLAUDE.md

Proyecto **BellAI**: panel de administración (React 19 + Vite en `Frontend/`) sobre una API NestJS (`backend/`) con PostgreSQL 17, Redis (BullMQ), un servicio de IA en FastAPI con MediaPipe/CLIP (`backend/ai/`) y un asistente con Kimi (API) u Ollama local. La app móvil está en `../Movil`.

## Lee esto antes de trabajar

| Archivo | Qué contiene |
|---|---|
| [`.rules/`](./.rules/README.md) | **Las reglas.** Normas cortas y verificables, por tema. |
| [`AGENTS.md`](./AGENTS.md) | Panorama del sistema, tabla de endpoints y **estado real** (lo que está roto de verdad). |
| [`Frontend/AGENTS.md`](./Frontend/AGENTS.md) | Arquitectura del frontend en detalle y deuda técnica. |

Según lo que vayas a tocar: [`.rules/10-frontend.md`](./.rules/10-frontend.md) para `Frontend/**`, [`.rules/20-backend.md`](./.rules/20-backend.md) para `backend/**`, [`.rules/30-git-y-entrega.md`](./.rules/30-git-y-entrega.md) antes de entregar.

## Lo mínimo que no puedes ignorar

- **Español** en UI, comentarios, documentación y commits.
- **No commitees ni abras PRs** si no te lo piden. Rama por persona → PR a `main`.
- El frontend es **feature-based por capas**: `app/` y `layouts/` (shell) → `features/` (dominio) → `shared/` (base). `shared/` nunca importa de `features/`; entre features solo por el barril `index.ts`; dentro de una feature, imports relativos. **ESLint lo verifica**: `pnpm lint` falla si lo rompes.
- Las peticiones HTTP van siempre por `apiClient` de `@/shared/lib/axios`, dentro del `service` de su feature. Nunca `axios` suelto ni `fetch`.
- Estilos con tokens del tema (`bg-card`, `text-muted-foreground`, `border-border`), no colores crudos. Tailwind v4 se configura en `src/index.css`, sin `tailwind.config.js`.
- Cambio de esquema = `backend/schema.sql` **y** migración en `backend/src/migrations/`. `synchronize` de TypeORM se queda en `false`.
- No añadas dependencias nuevas sin decirlo.

## Comandos

```bash
docker compose up -d                          # todo el sistema
cd Frontend && pnpm install && pnpm dev       # SPA  -> http://localhost:5173
cd backend  && npm install  && npm run dev    # API  -> http://localhost:8000/api (Swagger: /api/docs)
cd backend  && npm test                       # Jest: motores de estilo, outfits, semáforo, diagnóstico
cd backend/ai && .venv/bin/pytest             # servicio de IA
cd Frontend && pnpm build                     # tsc -b && vite build: debe pasar limpio
cd Frontend && pnpm lint                      # debe pasar limpio
```

Credenciales de demostración: `valeria@bellia.com` / `123456789`.

## Trampas conocidas

- La app móvil (Expo, repo hermano `../Movil`) consume esta misma API: si cambias un contrato de `auth`, `profile`, `privacy`, `upload` o `wardrobe`, revisa también sus `services`.
- El asistente usa Kimi con `KIMI_API_KEY` en `backend/.env` (hay que reiniciar la API al cambiarla); sin clave usa Ollama con el modelo de `llm_model`. No le mandes al modelo el perfil entero: añade datos como sección de tema o como herramienta en `assistant/assistant.context.ts`.
- El panel web no tiene tests (solo lint + build en CI). Backend: Jest + `node --test`; IA: pytest.
- Los pesos de IA no están en git: `backend/ai/scripts/download_models.py models --with-clip`.
- El contenedor `bellia_frontend` del puerto 5173 sirve un build ya compilado: para ver cambios ahí hay que `docker compose up -d --build frontend`.

La lista completa está en la sección "Estado real" de [`AGENTS.md`](./AGENTS.md).
