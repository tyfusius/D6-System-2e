import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stableIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (entry): entry is string =>
              typeof entry === "string" && entry.trim().length > 0,
          ),
        ),
      ]
    : [];
}

export function addSuperheroicTemplateProvenance(source: ActorSource): void {
  if (source.type !== "character") return;
  const creation = record(source.system.creation) ?? {};
  const template = record(creation.template) ?? {};
  source.system.creation = {
    ...creation,
    template: {
      ...template,
      rulesFamily:
        template.rulesFamily === "superheroic"
          ? "superheroic"
          : template.rulesFamily === "open-d6-first-edition"
            ? "open-d6-first-edition"
            : "d6-system-second-edition",
      superpowerCreationDice:
        Number.isSafeInteger(template.superpowerCreationDice) &&
        Number(template.superpowerCreationDice) > 0
          ? Number(template.superpowerCreationDice)
          : 0,
      superpowerDefinitionIds: stableIds(template.superpowerDefinitionIds),
    },
  };
}

export const addSuperheroicTemplateProvenanceMigration: Migration =
  Object.freeze({
    name: "Add Superheroic Template provenance",
    updateActor: addSuperheroicTemplateProvenance,
    version: 38,
  });
