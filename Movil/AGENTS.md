This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## UI/UX visual y navegación

- La fuente de verdad de la revisión y el plan visual es [`design.md`](./design.md). Consúltalo antes de modificar pantallas, componentes compartidos, temas o destinos de navegación.
- La aplicación visible se llama **BellAI**. No introducir ni mostrar Bellia, Bella IA o AURA como nombres alternos sin una decisión de producto documentada.
- La navegación principal tiene cinco destinos equivalentes en móvil y web: Inicio, Armario, Mi análisis, Asistente y Perfil. Las rutas auxiliares no se añaden a la barra principal sin actualizar primero el mapa de navegación en `design.md`.
- Ejecutar las mejoras visuales en el orden de fases definido en `design.md`: coherencia de navegación, sistema visual, recorridos principales y validación. No ampliar la superficie de producto antes de consolidar la fase anterior.
- Usar tokens de `@/shared/theme` y componentes de `@/shared/ui`. Las excepciones visuales deben justificarse y documentarse en `design.md`.

## Casos de uso

- El estado de cada historia de usuario en la app está en [`docs/CasosDeUsos/README.md`](./docs/CasosDeUsos/README.md); backend, IA y criterios de prueba en `../Frontend_Backend/docs/CasosDeUsos/`.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Business Model & Production Rules (Mandatory)

Always follow the business model and production rules in [.agents/rules/business.md](file:///c:/Users/ldgd2/Documents/universidad/software%201/sem%202-2026/Movil/.agents/rules/business.md):
1. **Linguistic Control & Anti-Slop**: Eradicate AI markers, banlist words (*delve*, *testament*, *tapestry*), cliché negative parallelism ("not just X, but Y"), and mechanical rule-of-three trios.
2. **Epistemic Integrity & Zero Sycophancy**: Prioritize technical accuracy and customer safety over conversational agreement. Never validate false or risky assumptions. Calibrate uncertainty with structured abstention and forbid hallucinated metrics.
3. **Accessibility (WCAG 2.2 AA)**: Mandatory `accessibilityRole`, `accessibilityLabel`, 44x44 minimum touch targets, and semantic emoji isolation across all interactive components.
4. **Security & Brand Abstraction**: Never expose backend architecture, raw database variable names (`is_active_boolean`), or UUIDs in the UI. Translate all system errors into natural human language with immediate recovery action (no raw HTTP/SQL errors).
5. **Operational Efficiency & Anti-Vibe Coding**: Revisit and reuse design tokens in `@/shared/theme` and component library in `@/shared/ui`. Mandatory 3 states for all asynchronous flows: Empty/Onboarding, Loading/Skeleton, and Error with Retry.
