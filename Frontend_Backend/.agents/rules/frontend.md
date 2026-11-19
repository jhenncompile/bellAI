---
trigger: glob
globs: "Frontend/**/*.ts, Frontend/**/*.tsx, Frontend/**/*.css, Frontend/*.json"
description: Arquitectura feature-based del frontend, reglas de dependencia entre capas, convenciones de nombres y estilos.
---

# Frontend — arquitectura feature-based

Reglas completas en `.rules/10-frontend.md`. Arquitectura en detalle y deuda técnica en `Frontend/AGENTS.md`.

```
src/app/        shell: providers, AppRoutes, setup
src/layouts/    shell: AdminLayout, Sidebar, Topbar
src/features/   dominio: auth, dashboard, users, profile, privacy
src/shared/     base: ui, feedback, lib, store, types
```

## Reglas de dependencia (las verifica ESLint)

- `shared/` **nunca** importa de `features/`, `layouts/` ni `app/`. Para invertir la dependencia, usa un registro como `shared/lib/auth-bridge.ts`.
- Entre features, solo por el barril: `@/features/auth`. Nunca `@/features/auth/store/auth.store`.
- **Dentro** de una feature, imports relativos (`../services/users.service`). **Cruzando** capas, alias `@/`.
- `pnpm lint` falla si rompes esto (`no-restricted-imports` en `Frontend/eslint.config.js`). No lo silencies con `eslint-disable`.

## Convenciones

- Feature nueva ⇒ carpeta en `features/` con su `index.ts` como API pública.
- Rutas **solo** en `src/app/routes/AppRoutes.tsx`.
- Peticiones HTTP por `apiClient` de `@/shared/lib/axios`, dentro del `service` de su feature. Nunca `axios` suelto ni `fetch`.
- Nombres: `<f>.service.ts`, `<f>.types.ts`, `<f>.schema.ts`, `<nombre>.store.ts` → `use<Nombre>Store`. DTOs con sufijo `DTO`.
- No exportes constantes desde un archivo de componente: van en `constants/`.
- Estilos con tokens del tema (`bg-card`, `text-muted-foreground`, `border-border`), nunca colores crudos. Tailwind v4 se configura en `src/index.css`, sin `tailwind.config.js`.
