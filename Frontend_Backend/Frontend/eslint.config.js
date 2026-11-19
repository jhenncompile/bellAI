import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * Features existentes. Si creas una feature nueva, añádela aquí para que la regla
 * "dentro de una feature se usan imports relativos" también la cubra.
 * Reglas de arquitectura documentadas en ../.rules/10-frontend.md
 */
const FEATURES = ['auth', 'dashboard', 'privacy', 'profile', 'users']

const VER_REGLAS = 'Ver .rules/10-frontend.md'

// Una feature solo se importa por su barril, nunca por sus rutas internas.
const SIN_IMPORTS_PROFUNDOS_ENTRE_FEATURES = {
  group: ['@/features/*/*', '@/features/*/**'],
  message: `Importa otra feature solo por su barril: '@/features/<feature>'. ${VER_REGLAS}`,
}

// app/ es la capa shell: nadie importa hacia arriba.
const SIN_IMPORTS_A_APP = {
  group: ['@/app', '@/app/*', '@/app/**'],
  message: `Nada importa de 'app/': es la capa shell que compone la aplicación. ${VER_REGLAS}`,
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // shared/ es la capa base: agnóstica de dominio, no conoce las capas de arriba.
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/features',
                '@/features/*',
                '@/features/**',
                '@/layouts',
                '@/layouts/*',
                '@/layouts/**',
                '@/app',
                '@/app/*',
                '@/app/**',
              ],
              message: `'shared/' no puede importar de 'features/', 'layouts/' ni 'app/'. Invierte la dependencia con un registro, como shared/lib/auth-bridge.ts. ${VER_REGLAS}`,
            },
          ],
        },
      ],
    },
  },

  // layouts/ es shell: puede usar barriles de features, pero no rutas internas ni app/.
  {
    files: ['src/layouts/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [SIN_IMPORTS_PROFUNDOS_ENTRE_FEATURES, SIN_IMPORTS_A_APP] },
      ],
    },
  },

  // features/: entre features solo por el barril; nunca hacia app/.
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [SIN_IMPORTS_PROFUNDOS_ENTRE_FEATURES, SIN_IMPORTS_A_APP] },
      ],
    },
  },

  // Dentro de una feature se usan imports relativos: el alias a sí misma crea un
  // ciclo con su propio barril.
  ...FEATURES.map((feature) => ({
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            SIN_IMPORTS_PROFUNDOS_ENTRE_FEATURES,
            SIN_IMPORTS_A_APP,
            {
              group: [
                `@/features/${feature}`,
                `@/features/${feature}/*`,
                `@/features/${feature}/**`,
              ],
              message: `Dentro de la feature '${feature}' usa imports relativos ('../services/...'), no el alias a sí misma. ${VER_REGLAS}`,
            },
          ],
        },
      ],
    },
  })),
])
