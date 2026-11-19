# AGENTS.md — Frontend (Panel de Administración Bellia)

Arquitectura y convenciones de la SPA, explicadas. El resumen normativo y verificable está en **[`../.rules/10-frontend.md`](../.rules/10-frontend.md)**; para el panorama del sistema completo (backend, IA, Docker, estado del proyecto) lee **[`../AGENTS.md`](../AGENTS.md)**.

---

## 1. Qué es esta app

Panel de administración del Sistema Bellia: login con JWT, dashboard con métricas, gestión de usuarios, perfil con avatar, preferencias y un módulo de privacidad RGPD. Es una SPA que consume la API NestJS en `http://localhost:8000/api`.

| Pieza | Versión |
|---|---|
| React | 19.2 (con `babel-plugin-react-compiler` instalado pero **no activado** en `vite.config.ts`) |
| Vite | 6.4 · TypeScript 6.0 (estricto: `noUnusedLocals`, `verbatimModuleSyntax`) |
| Tailwind CSS | 4.3 (config en `src/index.css`, sin `tailwind.config.js`) |
| shadcn / `@base-ui/react` | 4.19 — alias en `components.json` |
| Estado | Zustand 5 (global) · TanStack Query 5 (montado, aún sin usar) |
| Formularios | React Hook Form 7 + Zod 4 |
| Router | React Router 8 (`react-router`, no `react-router-dom`) |
| Gráficas | Recharts 3 · Iconos: `lucide-react` |

Gestor de paquetes: **pnpm**.

```bash
pnpm install    pnpm dev    pnpm build    pnpm lint
```

---

## 2. Arquitectura: feature-based por capas

```
src/
├── main.tsx                  # punto de entrada
├── index.css                 # Tailwind v4 + tokens de tema
├── app/                      # CAPA SHELL: compone la aplicación
│   ├── App.tsx               # providers + rutas
│   ├── providers/            # QueryClientProvider, BrowserRouter
│   ├── routes/               # AppRoutes.tsx (tabla de rutas), NotFoundPage
│   └── setup/                # axios-auth.ts: conecta Axios con el store de auth
├── layouts/                  # CAPA SHELL: chrome del panel
│   ├── AdminLayout.tsx       # <Outlet/> + aplicación del tema al <html>
│   └── components/           # Sidebar, Topbar
├── features/                 # CAPA DE DOMINIO: una carpeta por área de negocio
│   ├── auth/      · login, sesión JWT, ProtectedRoute
│   ├── dashboard/ · métricas y gráficas (datos aún simulados)
│   ├── users/     · listado, filtros y alta de usuarios
│   ├── profile/   · perfil + preferencias (mismo dominio /api/profile)
│   └── privacy/   · RGPD: exportación, consentimientos, derecho al olvido
└── shared/                   # CAPA BASE: agnóstica de dominio
    ├── components/ui/        # primitivas de shadcn
    ├── components/feedback/  # AlertMessage, LoadingSpinner
    ├── lib/                  # axios, auth-bridge, query-client, utils, avatar
    ├── store/                # ui.store.ts (tema y sidebar)
    └── types/                # api.types.ts
```

Anatomía de una feature (no todas usan todas las carpetas):

```
features/<feature>/
├── index.ts         # API PÚBLICA: lo único que otras capas pueden importar
├── pages/           # pantallas conectadas al router
├── components/      # componentes de esta feature
├── services/        # <feature>.service.ts: llamadas HTTP vía apiClient
├── types/           # <feature>.types.ts
├── schemas/         # <feature>.schema.ts: validación Zod
├── store/           # <feature>.store.ts (sólo auth lo necesita hoy)
└── constants/       # datos estáticos del dominio
```

### Reglas de dependencia (importante)

1. `shared/` **nunca** importa de `features/` ni de `layouts/`. Si algo en `shared/` necesita datos de una feature, se invierte la dependencia con un registro, como `shared/lib/auth-bridge.ts`.
2. `features/` puede importar de `shared/`.
3. Una feature importa de otra **sólo a través de su `index.ts`** (`import { useAuthStore } from '@/features/auth'`), nunca de rutas internas.
4. `app/` y `layouts/` son la capa shell: componen features y pueden importar sus barriles. Por eso `Sidebar`/`Topbar` pueden usar `@/features/auth`.
5. **Dentro** de una feature, imports **relativos** (`../services/users.service`). **Cruzando** capas, alias **`@/`** (`@/shared/lib/axios`). Nunca `@/features/users/...` desde dentro de `users`: crearía un ciclo con su propio barril.

### El puente Axios ↔ auth

`shared/lib/axios.ts` necesita el token JWT y provocar el logout global ante un 401, pero no puede importar la feature de auth (regla 1). La solución:

- `shared/lib/auth-bridge.ts` expone `registerAuthBridge({ getToken, onUnauthorized })` con *no-ops* por defecto.
- `app/setup/axios-auth.ts` registra el store real; se importa desde `app/App.tsx`, así que corre antes del primer render y de cualquier petición.

Si añades otra dependencia de `shared` hacia una feature, usa el mismo patrón.

### Estas reglas están verificadas por ESLint

Las reglas 1, 2, 3 y 5 las impone `eslint.config.js` con `no-restricted-imports`, por capa. `pnpm lint` falla con un mensaje que apunta a `.rules/10-frontend.md`. No las silencies con `eslint-disable`: si crees que una regla está mal, cámbiala en `eslint.config.js` y en `.rules/10-frontend.md` a la vez.

Si creas una feature nueva, añádela al array `FEATURES` de `eslint.config.js` para que también quede cubierta por la regla 3.

---

## 3. Dónde va cada cosa

| Quiero añadir… | Va en… |
|---|---|
| Una pantalla nueva de un dominio existente | `features/<f>/pages/` + exportarla en `features/<f>/index.ts` + ruta en `app/routes/AppRoutes.tsx` |
| Un dominio nuevo completo | `features/<nuevo>/` con su `index.ts`, y la ruta en `AppRoutes.tsx` |
| Una llamada a un endpoint | el `services/<f>.service.ts` de su feature, usando `apiClient` (nunca `axios` ni `fetch` directo) |
| Un componente reutilizable en varias features | `shared/components/` (si es de dominio, se queda en la feature) |
| Una primitiva de shadcn | `pnpm dlx shadcn@latest add <componente>` → aterriza en `shared/components/ui/` por `components.json` |
| Estado global de UI (tema, sidebar…) | `shared/store/ui.store.ts` |
| Estado global de sesión | `features/auth/store/auth.store.ts` |
| Un esquema de validación | `features/<f>/schemas/<f>.schema.ts` |
| Un tipo de dominio | `features/<f>/types/<f>.types.ts` (si es genérico de API: `shared/types/api.types.ts`) |

### Convenciones de nombres

- Componentes y páginas: `PascalCase.tsx`, export **nombrado** (no `default`, salvo `App.tsx`).
- Servicios: `<feature>.service.ts`, exportando un objeto `<feature>Service`.
- Tipos: `<feature>.types.ts`. DTOs en sufijo `DTO` (`CreateUserDTO`, `UpdateProfileDTO`).
- Stores: `<nombre>.store.ts`, exportando `use<Nombre>Store`.
- Esquemas: `<nombre>.schema.ts`, exportando `<nombre>Schema` + `<Nombre>FormValues`.
- No exportes constantes desde un archivo de componente: ESLint (`react-refresh/only-export-components`) lo marca como error. Ponlas en `constants/`.

### Estilos

- Usa **tokens de tema**: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`. Están definidos en `src/index.css` para claro y oscuro.
- El tema se aplica añadiendo/quitando la clase `dark` en `<html>` desde `AdminLayout`, con el valor que persiste `ui.store.ts`.
- Deuda conocida: hay colores crudos sueltos (`emerald-500`, `amber-500`, `rose-500`) y hex dentro de `UserMetricsChart.tsx`. No añadas más; si tocas esos archivos, muévelos a tokens.
- Mobile-first de verdad: el panel se prueba en Android por LAN (`server.host: true`). Mantén los breakpoints `sm:`/`md:` de los componentes existentes.

---

## 4. Datos, sesión y contratos de API

- `shared/lib/axios.ts` crea `apiClient` con `baseURL = VITE_API_URL ?? 'http://localhost:8000/api'`, timeout 10s, inyección automática de `Authorization: Bearer <token>` y logout global ante 401.
- Configura la URL del backend en `Frontend/.env` o `.env.local`:
  ```env
  VITE_API_URL=http://localhost:8000/api
  ```
- Zustand persiste en `localStorage` con las claves **`auth-storage`** (`user`, `token`, `isAuthenticated`) y **`ui-storage`** (`sidebarOpen`, `theme`). Si cambias la forma de un store, los usuarios ya tienen datos viejos guardados: considéralo.
- Credenciales de demo precargadas en el login: `valeria@bellia.com` / `123456789` (`features/auth/schemas/login.schema.ts`).

| Endpoint | Service | Pantalla |
|---|---|---|
| `POST /auth/login` | `auth.service.ts` → `login` | `LoginPage` |
| `GET /auth/me` | `auth.service.ts` → `getProfile` | (sin usar todavía) |
| `GET /usuarios` | `users.service.ts` → `getUsers` | `UsersPage` |
| `POST /usuarios` ⚠️ | `users.service.ts` → `createUser` | `UserFormModal` — **el backend no lo implementa** |
| `DELETE /usuarios/:id` ⚠️ | `users.service.ts` → `deleteUser` | `UserTable` — **el backend no lo implementa** |
| `PATCH /usuarios/:id/role` · `/status` | `users.service.ts` | (sin UI todavía) |
| `GET` / `PUT /profile` | `profile.service.ts` | `ProfilePage` |
| `PUT /profile/preferences` | `profile.service.ts` | `PreferencesPage` |
| `POST /upload/avatar` | `profile.service.ts` → `uploadAvatar` | `AvatarUploader` |
| `GET /privacy/export` | `privacy.service.ts` | `DataExportCard` |
| `GET` / `POST /privacy/consents` | `privacy.service.ts` | `ConsentsCard` |
| `POST /privacy/right-to-be-forgotten` | `privacy.service.ts` | `ForgetMeDialog` |
| `GET /privacy/audit-logs` | `privacy.service.ts` | (sin UI todavía) |

Rutas de la SPA (`app/routes/AppRoutes.tsx`): `/login` pública; `/dashboard`, `/users`, `/profile`, `/preferences`, `/privacy` dentro de `ProtectedRoute` + `AdminLayout`; `/` → `/dashboard`; `/settings` → `/preferences`; `*` → `NotFoundPage`.

---

## 5. Deuda técnica conocida

No la arregles de paso sin acordarlo, pero tampoco la imites:

- **El fetching no es uniforme.** Dashboard, usuarios, auditoría, incidencias, ajustes y modelos de IA usan TanStack Query; perfil, preferencias y privacidad siguen con `useState` + `useEffect` manual. Al tocarlas, pásalas a un `hooks/use<Feature>.ts`.
- **Tipos de usuario duplicados**: `User` (`features/auth/types/auth.types.ts`) y `AppUser` (`features/users/types/user.types.ts`) describen casi lo mismo.
- **La API devuelve las URLs de archivos con `http://localhost:8000`** cuando guarda en disco (`StorageService.cdnBaseUrl`). Los clientes lo corrigen al mostrar (`resolveMediaUrl` en `shared/lib/avatar.ts`, `resolveAvatarUrl` en el móvil); no construyas URLs de archivos a mano.
- **La clase CSS de los inputs está copiada ~20 veces.** Candidata a `shared/components/form/TextInput.tsx`.
- **Tests sin runner:** hay pruebas `node --test` de lógica pura (`features/dashboard/tests`, `features/users/tests`), pero ningún script de `package.json` ni la CI las ejecuta. Se lanzan con `node --test src/features/*/tests/*.mjs`.
- `react-compiler` está en `devDependencies` pero no configurado en `vite.config.ts`: el README antiguo afirmaba lo contrario.
