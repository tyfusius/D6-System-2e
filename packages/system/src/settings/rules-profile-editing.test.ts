import {
  D6_RULE_STRATEGY_SLOTS,
  type D6RulesProfileV4,
} from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import {
  applyRulesProfileEditorFields,
  RULES_PROFILE_EDITABLE_MECHANIC_SLOTS,
} from "./rules-profile-editing";

describe("Rules Profile editor field projection", () => {
  it("covers every required strategy plus optional Scale without adding a replacement resolver", () => {
    expect(RULES_PROFILE_EDITABLE_MECHANIC_SLOTS).toEqual([
      ...D6_RULE_STRATEGY_SLOTS,
      "scale",
    ]);
    expect(RULES_PROFILE_EDITABLE_MECHANIC_SLOTS).not.toContain(
      "rollResolution",
    );
  });

  it("round-trips provider metadata and non-form profile data while editing reachable fields", () => {
    const original = structuredClone({
      constraints: [
        {
          assertion: {
            equals: "d6e2.scale.ranked",
            kind: "strategy" as const,
            slot: "scale" as const,
          },
          id: "keep-provider-constraint",
          message: "Provider-owned requirement",
        },
      ],
      description: "Original description",
      difficultyLadder: [],
      healthModels: [{ id: "keep-health" }],
      homebrew: {
        matchingRewards: [
          {
            awards: {},
            enabled: false,
            evaluatorId: "keep-evaluator",
            detectorId: "keep-resolution",
            version: 1 as const,
          },
        ],
        tyfusiusD8ExplosiveDeviation: true,
      },
      id: "provider-rules",
      label: "Provider rules",
      matchingEvaluators: [{ id: "keep-evaluator" }],
      source: { kind: "module" as const, ownerId: "keep-provider" },
      strategies: {
        ...Object.fromEntries(
          D6_RULE_STRATEGY_SLOTS.map((slot) => [slot, `provider.${slot}`]),
        ),
        scale: "open-d6.scale.scalar",
      },
      terminology: { resources: { heroPoints: "Resolve" } },
      version: 4,
    }) as unknown as D6RulesProfileV4;

    const updated = applyRulesProfileEditorFields(original, {
      description: "Edited description",
      label: "Edited label",
      strategies: {
        ...original.strategies,
        scale: "d6e2.scale.ranked",
      },
      tyfusiusD8ExplosiveDeviation: false,
    });

    expect(updated).toMatchObject({
      description: "Edited description",
      label: "Edited label",
      strategies: { scale: "d6e2.scale.ranked" },
      homebrew: { tyfusiusD8ExplosiveDeviation: false },
    });
    expect(updated.constraints).toEqual(original.constraints);
    expect(updated.healthModels).toEqual(original.healthModels);
    expect(updated.matchingEvaluators).toEqual(original.matchingEvaluators);
    expect(updated.source).toEqual(original.source);
    expect(updated.terminology).toEqual(original.terminology);
    expect(updated.homebrew.matchingRewards).toEqual(
      original.homebrew.matchingRewards,
    );
  });
});
