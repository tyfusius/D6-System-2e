import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addSecondEditionAdvancementWorkflows(
  source: ActorSource,
): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const advancement = record(source.system.advancement) ?? {};
  const milestone = record(advancement.milestone) ?? {};
  source.system.advancement = {
    ...advancement,
    milestone: {
      ...milestone,
      attributeDice: Number.isSafeInteger(milestone.attributeDice)
        ? Math.max(0, Number(milestone.attributeDice))
        : 0,
      skillPips: Number.isSafeInteger(milestone.skillPips)
        ? Math.max(0, Number(milestone.skillPips))
        : 0,
    },
    narrativeArcs: Array.isArray(advancement.narrativeArcs)
      ? advancement.narrativeArcs
      : [],
  };
}

export const addSecondEditionAdvancementWorkflowsMigration: Migration =
  Object.freeze({
    name: "Add Second Edition Milestone and Narrative advancement workflows",
    updateActor: addSecondEditionAdvancementWorkflows,
    version: 13,
  });
