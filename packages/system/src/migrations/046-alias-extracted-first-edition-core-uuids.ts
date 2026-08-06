import type { ActorSource, ItemSource, Migration } from "@d6-system-2e/core";
import { resolveContentPackUuid } from "../foundry/content-uuid-compatibility";

function rewrite(value: unknown): unknown {
  if (typeof value === "string") return resolveContentPackUuid(value);
  if (Array.isArray(value)) return value.map(rewrite);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      rewrite(child),
    ]),
  );
}

export function aliasExtractedFirstEditionCoreUuids(
  source: ActorSource | ItemSource,
): void {
  source.system = rewrite(source.system) as Record<string, unknown>;
  if ("flags" in source) source.flags = rewrite(source.flags);
}

export const aliasExtractedFirstEditionCoreUuidsMigration: Migration =
  Object.freeze({
    name: "Alias extracted First Edition Core Content UUIDs",
    updateActor: aliasExtractedFirstEditionCoreUuids,
    updateItem: aliasExtractedFirstEditionCoreUuids,
    version: 46,
  });
