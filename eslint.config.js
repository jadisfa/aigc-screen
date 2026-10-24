import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "demo"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: [
      "src/shared/ui/**/*.{ts,tsx}",
      "src/modules/modelhub/components/ModelCapabilityFieldRegistry.tsx",
      "src/modules/modelhub/components/ModelCapabilityPricingEditors.tsx",
      "src/modules/workflow/components/pagebuilder/**/*.{ts,tsx}",
      "src/modules/workflow/components/preview/LiveTaskStatus.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
