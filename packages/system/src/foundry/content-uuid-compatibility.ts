const LEGACY_PACKAGE_ID = "d6-system-2e";
const CORE_CONTENT_PACKAGE_ID = "d6-system-2e-core-content";
const EXTRACTED_PACKS = [
  "second-edition-skills",
  "second-edition-equipment",
] as const;

export function resolveContentPackUuid(uuid: string): string {
  let resolved = uuid;
  for (const pack of EXTRACTED_PACKS) {
    resolved = resolved.replaceAll(
      `Compendium.${LEGACY_PACKAGE_ID}.${pack}`,
      `Compendium.${CORE_CONTENT_PACKAGE_ID}.${pack}`,
    );
  }
  return resolved;
}
