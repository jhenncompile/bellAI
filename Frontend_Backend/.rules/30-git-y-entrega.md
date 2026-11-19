# Reglas de Git y de entrega

## Ramas y Pull Requests

1. Rama por persona o por tarea (`Alan`, `valeria`, …) y **Pull Request hacia `main`**. No se empuja directo a `main`.
2. **No commitees ni abras un PR si no te lo han pedido explícitamente.** Deja el trabajo en el working tree y explica qué cambiaste.
3. Un PR, un tema. Si un cambio arrastra un refactor grande, sepáralo.

## Mensajes de commit

4. En español, en imperativo, con prefijo de tipo:

```
feat: añade endpoint POST /api/usuarios
fix: corrige la URL del avatar fuera de localhost
refactor: mueve las páginas a su feature
docs: actualiza el estado real en AGENTS.md
chore: regenera el lockfile de pnpm
```

5. El cuerpo explica **por qué**, no qué líneas cambiaron: eso ya lo dice el diff.

## Archivos que sí se commitean

6. `Frontend/pnpm-lock.yaml` **se commitea**. El proyecto usa pnpm; si lo borras, cada persona instala versiones distintas.
7. `AGENTS.md`, `.rules/` y los archivos de enganche (`CLAUDE.md`, `.cursor/`, `.agents/`) son parte del proyecto, no basura local.
8. `Frontend/dist/` y `node_modules/` están en `.gitignore`. No los fuerces con `git add -f`.

## Checklist antes de entregar

- [ ] `cd Frontend && pnpm build` pasa limpio.
- [ ] `pnpm lint` no suma avisos nuevos sobre los 6 preexistentes.
- [ ] Si cambié un contrato de API: backend, `service` del frontend y tabla de `AGENTS.md`, los tres.
- [ ] Si cambié el esquema: `backend/schema.sql` **y** migración en `backend/src/migrations/`.
- [ ] Si toqué `backend/ai/**`: `pytest` pasa.
- [ ] Si descubrí algo que contradice la documentación: actualicé "Estado real" en `AGENTS.md`.
- [ ] Si añadí una regla nueva de arquitectura: está en `.rules/` y, si se puede verificar, en `eslint.config.js`.
