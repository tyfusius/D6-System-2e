import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function admitNarrativePerkRewards(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const advancement = record(source.system.advancement);
  const arcs = advancement?.narrativeArcs;
  if (!Array.isArray(arcs)) return;
  source.system.advancement = {
    ...advancement,
    narrativeArcs: arcs.map((value: unknown): unknown => {
      const arc = record(value);
      if (arc?.rewardKind !== "perk") return value;
      return {
        ...arc,
        rewardId: typeof arc.rewardId === "string" ? arc.rewardId : "",
        targetScore: Number.isSafeInteger(arc.targetScore)
          ? Math.max(1, Number(arc.targetScore))
          : 1,
      };
    }),
  };
}

export const admitNarrativePerkRewardsMigration: Migration = Object.freeze({
  name: "Admit Narrative Perk rewards",
  updateActor: admitNarrativePerkRewards,
  version: 22,
});
