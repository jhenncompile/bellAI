// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "android/*", "ios/*"],
    rules: {
      // eslint-plugin-import no entiende los "exports" condicionales de estos paquetes de Expo;
      // TypeScript y Metro sí los resuelven (la app compila y se empaqueta para Android).
      "import/no-unresolved": ["error", { ignore: ["^expo-sqlite$", "^expo-media-library/legacy$"] }],
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);
