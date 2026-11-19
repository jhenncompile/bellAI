# 🚀 Panel de Administración - Frontend

Aplicación frontend del **Panel de Administración del Sistema Bellia**, desarrollada con **React 19**, **Vite**, **TypeScript**, **Tailwind CSS v4** y **Shadcn UI v4**. La arquitectura sigue el patrón **feature-based** (organizada por dominio de negocio y por capas), buscando escalabilidad y tipado estricto.

> Si vas a programar aquí, lee **[`AGENTS.md`](./AGENTS.md)**: contiene las reglas de capas, las convenciones de nombres, los contratos de API y la deuda técnica conocida.

---

## 🛠️ Pila Tecnológica

### Core y Renderizado
* **React `19.2`**: incluye `babel-plugin-react-compiler` como dependencia, pero el React Compiler **todavía no está activado** en `vite.config.ts`.
* **Vite `6.4`**: servidor de desarrollo con HMR y bundler de producción.
* **TypeScript `6.0`**: tipado estricto (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`).

### Interfaz de Usuario y Estilos
* **Tailwind CSS `4.3`**: configurado por completo en `src/index.css` (sin `tailwind.config.js`).
* **Shadcn UI `4.19` + `@base-ui/react`**: primitivas accesibles en `src/shared/components/ui/`.
* **Lucide React `1.55`**: iconografía SVG.
* **Recharts `3.10`**: gráficas del dashboard.
* **`@fontsource-variable/inter`**: tipografía Inter cargada localmente.

### Estado y Peticiones
* **Zustand `5.0`**: estado global persistido en `localStorage` (`auth-storage` y `ui-storage`).
* **TanStack React Query `5.102`**: el provider y el cliente están configurados, pero el fetching actual todavía es manual con `useState`/`useEffect` (ver deuda técnica en `AGENTS.md`).
* **Axios `1.20`**: cliente con interceptores que inyectan el JWT (`Authorization: Bearer <token>`) y cierran sesión ante un 401.

### Formularios y Enrutamiento
* **React Hook Form `7.87` + Zod `4.5`**: formularios tipados y validados.
* **React Router `8.3`** (paquete `react-router`): rutas públicas y privadas protegidas.

---

## 📂 Estructura del Proyecto

```
Frontend/src/
├── main.tsx                  # Punto de entrada
├── index.css                 # Tailwind v4 + tokens de tema (claro / oscuro)
├── app/                      # Composición de la aplicación
│   ├── App.tsx               # Providers + rutas
│   ├── providers/            # QueryClientProvider, BrowserRouter
│   ├── routes/               # AppRoutes.tsx, NotFoundPage.tsx
│   └── setup/                # axios-auth.ts (conecta Axios con el store de sesión)
├── layouts/                  # Chrome del panel
│   ├── AdminLayout.tsx
│   └── components/           # Sidebar.tsx, Topbar.tsx
├── features/                 # Un directorio por dominio de negocio
│   ├── auth/                 # login, sesión JWT, ProtectedRoute
│   ├── dashboard/            # métricas y gráficas
│   ├── users/                # listado, filtros y alta de usuarios
│   ├── profile/              # perfil y preferencias (dominio /api/profile)
│   └── privacy/              # RGPD: exportación, consentimientos, derecho al olvido
└── shared/                   # Código agnóstico de dominio
    ├── components/ui/        # Primitivas de Shadcn
    ├── components/feedback/  # AlertMessage, LoadingSpinner
    ├── lib/                  # axios, auth-bridge, query-client, utils, avatar
    ├── store/                # ui.store.ts (tema y sidebar)
    └── types/                # api.types.ts
```

Cada feature se organiza igual y expone su API pública en un `index.ts`:

```
features/<feature>/
├── index.ts        # lo único que otras capas importan
├── pages/          # pantallas del router
├── components/     # componentes del dominio
├── services/       # <feature>.service.ts (llamadas HTTP)
├── types/          # <feature>.types.ts
├── schemas/        # validación con Zod
├── store/          # estado global del dominio
└── constants/      # datos estáticos
```

**Reglas de dependencia:** `shared/` nunca importa de `features/`; `app/` y `layouts/` componen features; entre features sólo se importa a través del `index.ts`. Dentro de una feature se usan rutas relativas y, cruzando capas, el alias `@/`.

---

## 📦 Gestor de Paquetes y Comandos (`pnpm`)

```bash
pnpm install     # Instalar dependencias
pnpm dev         # Servidor de desarrollo -> http://localhost:5173
pnpm build       # tsc -b && vite build -> dist/
pnpm preview     # Previsualizar la build de producción
pnpm lint        # ESLint
```

Para añadir primitivas de Shadcn (aterrizan en `src/shared/components/ui/` según `components.json`):

```bash
pnpm dlx shadcn@latest add <componente>
```

---

## 🔐 Credenciales de Demostración (Login)

* **Correo**: `valeria@bellia.com`
* **Contraseña**: `123456789`

El formulario de login las trae precargadas y tiene un botón para rellenarlas.

---

## 🌐 Variables de Entorno

Crea un archivo `.env` o `.env.local` en la raíz de `Frontend/`:

```env
VITE_API_URL=http://localhost:8000/api
```

Si no se define, se usa `http://localhost:8000/api` por defecto. El servidor de desarrollo escucha en `0.0.0.0` (`server.host: true`) para poder probar el panel desde un móvil en la red local.
