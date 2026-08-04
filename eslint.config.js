import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "**/*.map",
      "packages/d6-system-2e-core-content/d6-system-2e-core-content.mjs",
      "packages/d6-system-2e-fantasy/d6-system-2e-fantasy.mjs",
      "packages/open-d6-space-d6-system-2e/open-d6-space-d6-system-2e.mjs",
      "packages/open-d6-fantasy-d6-system-2e/open-d6-fantasy-d6-system-2e.mjs",
      "packages/open-d6-fantasy-d6-system-2e/content/catalog.d.mts",
      "packages/echod6-companion-d6-system-2e/echod6-companion-d6-system-2e.mjs",
      "packages/token-action-hud-d6-system-2e/token-action-hud-d6-system-2e.mjs",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["packages/**/*.ts", "vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
        },
      ],
    },
  },
  {
    files: [
      "scripts/**/*.mjs",
      "packages/open-d6-fantasy-d6-system-2e/content/**/*.mjs",
    ],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
);
