const LEGACY_PACKAGE_ID = "d6-system-2e";
const EXTRACTED_PACK_OWNERS = Object.freeze({
  "second-edition-equipment": "d6-system-2e-core-content",
  "second-edition-fantasy-creatures": "d6-system-2e-fantasy",
  "second-edition-fantasy-templates": "d6-system-2e-fantasy",
  "second-edition-skills": "d6-system-2e-core-content",
});

export function resolveContentPackUuid(uuid: string): string {
  let resolved = uuid;
  for (const [pack, ownerId] of Object.entries(EXTRACTED_PACK_OWNERS)) {
    resolved = resolved.replaceAll(
      `Compendium.${LEGACY_PACKAGE_ID}.${pack}`,
      `Compendium.${ownerId}.${pack}`,
    );
  }
  return resolved;
}
