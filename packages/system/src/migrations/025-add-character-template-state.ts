import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function positiveInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function addCharacterTemplateState(source: ActorSource): void {
  if (source.type !== "character") return;
  const creation = record(source.system.creation) ?? {};
  const template = record(creation.template) ?? {};
  const suggestedSkillKeys = Array.isArray(template.suggestedSkillKeys)
    ? [
        ...new Set(
          template.suggestedSkillKeys.filter(
            (key): key is string => typeof key === "string" && key.length > 0,
          ),
        ),
      ]
    : [];
  source.system.creation = {
    ...creation,
    template: {
      // Preserve fields introduced by later schemas when this normalizer is
      // reused by the live DataModel after the original migration has run.
      ...template,
      applied: template.applied === true,
      catalogId: text(template.catalogId),
      label: text(template.label),
      ownerId: text(template.ownerId),
      sourceBook: text(template.sourceBook),
      sourcePage: positiveInteger(template.sourcePage),
      suggestedSkillKeys,
      templateId: text(template.templateId),
      version: positiveInteger(template.version),
    },
  };
}

export const addCharacterTemplateStateMigration: Migration = Object.freeze({
  name: "Add character template application state",
  updateActor: addCharacterTemplateState,
  version: 25,
});
