import schemaVersion from "../../../../schema-version.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function migrationMetadata(source: unknown): Record<string, unknown> {
  if (!isRecord(source) || !isRecord(source.system)) return {};
  return isRecord(source.system._migration) ? source.system._migration : {};
}

function initializeDocumentMetadata(document: unknown, source: unknown): void {
  const existing = migrationMetadata(source);
  if (
    typeof existing.foundry === "string" &&
    existing.foundry.length > 0 &&
    typeof existing.system === "string" &&
    existing.system.length > 0
  ) {
    return;
  }
  if (
    typeof document !== "object" ||
    document === null ||
    !("updateSource" in document) ||
    typeof document.updateSource !== "function"
  ) {
    return;
  }
  (document as FoundrySourceDocument).updateSource({
    "system._migration": {
      foundry: game.version ?? "",
      schema:
        Number.isSafeInteger(existing.schema) && Number(existing.schema) >= 0
          ? Number(existing.schema)
          : schemaVersion.latest,
      system: game.system.version ?? "",
    },
  });
}

export function registerMigrationMetadataHooks(): void {
  Hooks.on("preCreateActor", initializeDocumentMetadata);
  Hooks.on("preCreateItem", initializeDocumentMetadata);
}
