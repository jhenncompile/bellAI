---
trigger: always_on
description: Reglas generales del proyecto Sistema Bellia: idioma, alcance de los cambios, secretos, dependencias y flujo de Git.
---

# Sistema Bellia — reglas generales

Panel de administración: `Frontend/` (React 19 + Vite) sobre una API NestJS en `backend/`, con PostgreSQL 17, Redis y un microservicio de IA en FastAPI (`backend/ai/`).

Las reglas completas de este repositorio viven en la carpeta `.rules/`. **Léelas antes de cambiar código**:

- `.rules/00-generales.md` — idioma, alcance, secretos, dependencias.
- `.rules/30-git-y-entrega.md` — ramas, commits, checklist de entrega.
- `AGENTS.md` — panorama del sistema, tabla de endpoints y estado real.

## Lo mínimo

- **Español** en UI, comentarios, documentación y mensajes de commit.
- **No commitees ni abras Pull Requests** si no te lo piden. Rama por persona → PR a `main`.
- Haz lo que se pide y nada más. Si ves otro problema, anótalo en lugar de arreglarlo por tu cuenta.
- No metas secretos reales en el repositorio y no añadas dependencias nuevas sin justificarlo.
- Antes de dar algo por terminado, ejecútalo: `cd Frontend && pnpm build`.
- Credenciales de demostración: `valeria@bellia.com` / `123456789`.
