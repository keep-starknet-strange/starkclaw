// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const path = require("node:path");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  // Make TS path aliases (eg "@/ui/...") resolvable for eslint-plugin-import.
  {
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx", ".d.ts"],
      },
      "import/resolver": {
        typescript: {
          project: path.join(__dirname, "tsconfig.json"),
        },
      },
    },
  },
  {
    ignores: ["dist/*", "**/__tests__/**"],
  }
]);
