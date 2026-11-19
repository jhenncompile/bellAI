# Reglas del frontend (`Frontend/**`)

Arquitectura **feature-based por capas**. La explicación completa está en [`Frontend/AGENTS.md`](../Frontend/AGENTS.md).

## Las cuatro capas

```
src/app/        shell: providers, tabla de rutas, setup
src/layouts/    shell: AdminLayout, Sidebar, Topbar
src/features/   dominio: auth, dashboard, users, profile, privacy
src/shared/     base: ui, feedback, lib, store, types
```

## Reglas de dependencia (las impone ESLint)

1. `shared/` **nunca** importa de `features/`, `layouts/` ni `app/`. Si algo de `shared/` necesita datos de una feature, invierte la dependencia con un registro, como `shared/lib/auth-bridge.ts`.
2. Una feature importa de otra **solo por su barril**: `@/features/auth`. Nunca `@/features/auth/store/auth.store`.
3. **Dentro** de una feature, imports **relativos**: `../services/users.service`. Nunca `@/features/users/...` desde dentro de `users`, porque crea un ciclo con su propio barril.
4. **Cruzando** capas, alias `@/`: `@/shared/lib/axios`, `@/layouts/AdminLayout`.
5. `app/` y `layouts/` son la capa shell: pueden importar barriles de features. Solo `app/` puede importar de `app/`.

> `pnpm lint` falla si rompes 1, 2, 3 o 5. No silencies el error con un `eslint-disable`: si crees que la regla está mal, discútelo con el grupo y cambia `eslint.config.js` y esta regla a la vez.

## Anatomía de una feature

```
features/<f>/
├── index.ts        # API pública: lo único que otras capas importan
├── pages/          # pantallas del router
├── components/     # componentes del dominio
├── services/       # <f>.service.ts, llamadas HTTP vía apiClient
├── types/          # <f>.types.ts
├── schemas/        # <f>.schema.ts, validación Zod
├── store/          # <f>.store.ts (hoy solo auth)
└── constants/      # datos estáticos del dominio
```

6. Toda feature nueva lleva su `index.ts` y exporta por él solo lo que consumen otras capas.
7. Las rutas se declaran **únicamente** en `src/app/routes/AppRoutes.tsx`, importando las páginas desde los barriles.

## Dónde va cada cosa

| Quiero añadir… | Va en… |
|---|---|
| Pantalla de un dominio existente | `features/<f>/pages/` + barril + ruta en `AppRoutes.tsx` |
| Dominio nuevo | `features/<nuevo>/` con su `index.ts` |
| Llamada a un endpoint | `features/<f>/services/<f>.service.ts` |
| Componente reutilizable en varias features | `shared/components/` |
| Primitiva de shadcn | `pnpm dlx shadcn@latest add <x>` → cae en `shared/components/ui/` |
| Estado global de UI (tema, sidebar) | `shared/store/ui.store.ts` |
| Estado global de sesión | `features/auth/store/auth.store.ts` |
| Validación de formulario | `features/<f>/schemas/<f>.schema.ts` |
| Tipo de dominio | `features/<f>/types/<f>.types.ts` |

## Peticiones HTTP

8. Usa siempre `apiClient` de `@/shared/lib/axios`. **Nunca** `axios` suelto ni `fetch`: te saltarías la inyección del JWT y el logout automático ante un 401.
9. Las llamadas viven en el `service` de la feature, no en el componente ni en la página.
10. La URL base sale de `VITE_API_URL` (por defecto `http://localhost:8000/api`). No escribas `http://localhost:8000` en el código; ya hay una deuda así en `ProfilePage` y no queremos más.

## Convenciones de nombres

11. Componentes y páginas: `PascalCase.tsx` con export **nombrado** (solo `App.tsx` usa `default`).
12. Servicios: `<feature>.service.ts` exportando el objeto `<feature>Service`.
13. Tipos: `<feature>.types.ts`. Los DTO llevan sufijo `DTO`: `CreateUserDTO`, `UpdateProfileDTO`.
14. Stores: `<nombre>.store.ts` exportando `use<Nombre>Store`.
15. Esquemas: `<nombre>.schema.ts` exportando `<nombre>Schema` y `<Nombre>FormValues`.
16. **No exportes constantes desde un archivo de componente**: ESLint lo marca (`react-refresh/only-export-components`). Van en `constants/`.

## Estilos

17. Usa los tokens del tema: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`. Están definidos para claro y oscuro en `src/index.css`.
18. No añadas colores crudos (`emerald-500`, hex). Ya hay algunos como deuda; si tocas ese archivo, pásalos a tokens.
19. Tailwind v4 se configura en `src/index.css`. **No** crees un `tailwind.config.js`.
20. Mobile-first de verdad: el panel se prueba en Android por la red local. Respeta los breakpoints `sm:`/`md:` de los componentes existentes.

## Datos y estado

21. Zustand persiste en `localStorage` con las claves `auth-storage` y `ui-storage`. Si cambias la forma de un store, recuerda que los usuarios ya tienen datos viejos guardados.
22. TanStack Query está montado pero **sin usar**: todo el fetching es `useState` + `useEffect` manual. No mezcles los dos estilos en la misma pantalla sin acordarlo; la migración, cuando toque, va como `features/<f>/hooks/use<Feature>.ts`.

## Antes de terminar

```bash
cd Frontend
pnpm build   # tsc -b && vite build -> debe pasar limpio
pnpm lint    # hoy tiene 6 avisos preexistentes, ninguno nuevo
```

23. `pnpm build` debe pasar sin errores. Si `pnpm lint` suma avisos nuevos respecto a esos 6, son tuyos: arréglalos.
