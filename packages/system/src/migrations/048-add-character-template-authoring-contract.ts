import type { ItemSource, Migration } from "@d6-system-2e/core";
import fantasyTemplates from "../../../../content/fantasy-character-template-catalog.json" with { type: "json" };
import { SYSTEM_ID } from "../constants";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function addCharacterTemplateAuthoringContract(
  source: ItemSource,
): void {
  if (source.type !== "character-template") return;
  const system = record(source.system);
  const flags = record(
    record(record(source.flags)[SYSTEM_ID]).characterTemplate,
  );
  const templateId =
    typeof flags.templateId === "string"
      ? flags.templateId
      : typeof system.key === "string"
        ? system.key
        : "character-template";
  const published = fantasyTemplates.templates.find(
    (template) => template.id === templateId,
  );
  const attributeScores = Array.isArray(system.attributeScores)
    ? system.attributeScores
    : Object.entries(published?.attributeScores ?? {}).map(
        ([attributeId, score]) => ({ attributeId, score }),
      );
  const firstEdition = record(system.firstEdition);
  const sourceCitation = record(system.source);
  source.system = {
    ...system,
    attributeScores,
    description:
      typeof system.description === "string" ? system.description : "",
    firstEdition: {
      biography:
        typeof firstEdition.biography === "string"
          ? firstEdition.biography
          : "",
      characterPoints: Number.isSafeInteger(firstEdition.characterPoints)
        ? firstEdition.characterPoints
        : 0,
      fatePoints: Number.isSafeInteger(firstEdition.fatePoints)
        ? firstEdition.fatePoints
        : 0,
      move: Number.isSafeInteger(firstEdition.move) ? firstEdition.move : 10,
    },
    items: Array.isArray(system.items) ? system.items : [],
    key: templateId,
    rulesFamily:
      system.rulesFamily === "open-d6-first-edition" ||
      flags.rulesFamily === "open-d6-first-edition"
        ? "open-d6-first-edition"
        : "d6-system-second-edition",
    source: {
      book:
        typeof sourceCitation.book === "string"
          ? sourceCitation.book
          : (published?.source.book ?? "Custom template"),
      page: Number.isSafeInteger(sourceCitation.page)
        ? Math.max(1, Number(sourceCitation.page))
        : (published?.source.page ?? 1),
    },
    suggestedSkillKeys: Array.isArray(system.suggestedSkillKeys)
      ? system.suggestedSkillKeys
      : (published?.suggestedSkillKeys ?? []),
    unassignedAttributeScore: Number.isSafeInteger(
      system.unassignedAttributeScore,
    )
      ? system.unassignedAttributeScore
      : (published?.unassignedAttributeScore ?? 0),
    version: 2,
  };
}

export const addCharacterTemplateAuthoringContractMigration: Migration =
  Object.freeze({
    name: "Add complete Character Template authoring contracts",
    updateItem: addCharacterTemplateAuthoringContract,
    version: 48,
  });
