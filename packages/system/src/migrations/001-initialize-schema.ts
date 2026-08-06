import type { Migration } from "@d6-system-2e/core";

export const initializeSchemaMigration: Migration = Object.freeze({
  name: "Initialize versioned D6 System 2e schema metadata",
  version: 1,
});
