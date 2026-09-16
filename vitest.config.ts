import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@d6-system-2e/core": new URL(
        "./packages/core/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    coverage: {
      include: ["packages/core/src/**/*.ts"],
      reporter: ["text", "html"],
    },
    environment: "node",
    include: ["packages/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
