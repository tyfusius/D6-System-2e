import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addEditionAwareTemplateProvenance(source: ActorSource): void {
  if (source.type !== "character") return;
  const creation = record(source.system.creation) ?? {};
  const template = record(creation.template) ?? {};
  const stored = template.rulesFamily;
  const rulesFamily =
    stored === "superheroic" ||
    stored === "open-d6-first-edition" ||
    stored === "d6-system-second-edition"
      ? stored
      : "d6-system-second-edition";
  source.system.creation = {
    ...creation,
    template: { ...template, rulesFamily },
  };
}

export const addEditionAwareTemplateProvenanceMigration: Migration =
  Object.freeze({
    name: "Add edition-aware Character Template provenance",
    updateActor: addEditionAwareTemplateProvenance,
    version: 39,
  });
