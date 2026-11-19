# .rules — Reglas del proyecto Sistema Bellia

Esta carpeta es la **fuente de verdad** de las reglas que debe seguir cualquier persona o IA que trabaje en este repositorio. Son normas cortas y verificables.

Para la **explicación** de por qué son así, el estado real del proyecto y los contratos de API, lee:

- [`AGENTS.md`](../AGENTS.md) — panorama del sistema, endpoints, trampas conocidas.
- [`Frontend/AGENTS.md`](../Frontend/AGENTS.md) — arquitectura del frontend en detalle.

---

## Índice

| Archivo | Aplica a | Contenido |
|---|---|---|
| [`00-generales.md`](./00-generales.md) | todo el repo | Idioma, alcance de los cambios, secretos, qué no hacer |
| [`10-frontend.md`](./10-frontend.md) | `Frontend/**` | Capas, reglas de dependencia, dónde va cada cosa, nombres, estilos |
| [`20-backend.md`](./20-backend.md) | `backend/**` | Módulos NestJS, guards, DTOs, base de datos, cifrado |
| [`30-git-y-entrega.md`](./30-git-y-entrega.md) | todo el repo | Ramas, commits, PRs, checklist antes de entregar |

## Cómo las cargan las distintas IA

Los archivos de enganche son **punteros**: no duplican el contenido, apuntan aquí. Si cambias una regla, cámbiala en `.rules/` y ya aplica a todas.

| Herramienta | Archivo de enganche | Cómo se activa |
|---|---|---|
| Claude Code | `CLAUDE.md` | Se carga en cada sesión |
| Cursor | `.cursor/rules/*.mdc` | `proyecto.mdc` siempre; `frontend.mdc` / `backend.mdc` según el archivo abierto |
| Antigravity (Google) | `.agents/rules/*.md` + `AGENTS.md` | `trigger: always_on` y `trigger: glob`; también lee `AGENTS.md` de forma nativa |
| Codex, Zed, Amp, Jules y otros | `AGENTS.md` | Estándar `AGENTS.md`, leído de forma nativa |

Si añades otra herramienta, crea un puntero nuevo; **no copies el contenido**.

## Reglas que están verificadas automáticamente

Las reglas de capas del frontend no dependen de que la IA lea este archivo: `Frontend/eslint.config.js` las impone con `no-restricted-imports`, así que `pnpm lint` falla si se violan. Ver [`10-frontend.md`](./10-frontend.md).
