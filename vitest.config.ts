import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["packages/core/src/**/*.ts"],
      reporter: ["text", "html"],
    },
    environment: "node",
    include: ["packages/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
