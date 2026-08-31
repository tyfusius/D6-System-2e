import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D6MatchingEvaluatorContributionV1 } from "@d6-system-2e/core";
import {
  D6_NEXUS_MATCHING_DETECTOR_ID,
  matchingEvaluatorRegistry,
  matchingDetector,
  resetMatchingEvaluatorRegistryForTests,
} from "./matching-evaluators";

vi.stubGlobal("Hooks", { callAll: vi.fn() });

describe("matching evaluator registry", () => {
  beforeEach(resetMatchingEvaluatorRegistryForTests);

  it("bundles the additive matching detector without a replacement total resolver", () => {
    expect(matchingDetector("d6e2.roll-resolution.total")).toBeNull();
    expect(
      matchingDetector(D6_NEXUS_MATCHING_DETECTOR_ID)?.evaluator.patterns.map(
        ({ id }) => id,
      ),
    ).toEqual([
      "none",
      "pair",
      "two-pair",
      "three-kind",
      "full-house",
      "four-kind",
      "five-kind",
      "six-kind",
    ]);
  });

  it("keeps module contributions owner-scoped and removable", () => {
    const builtIn = matchingDetector(D6_NEXUS_MATCHING_DETECTOR_ID);
    if (!builtIn) throw new Error("fixture missing");
    const contribution: D6MatchingEvaluatorContributionV1 = {
      evaluator: {
        ...builtIn.evaluator,
        id: "frontier.matches",
        source: { kind: "module", ownerId: "frontier" },
      },
      id: "frontier.matches",
      label: "Frontier matching",
      version: 1,
    };
    matchingEvaluatorRegistry.register("frontier", contribution);
    expect(matchingDetector(contribution.id)?.id).toBe(contribution.id);
    matchingEvaluatorRegistry.unregisterOwner("frontier");
    expect(matchingDetector(contribution.id)).toBeNull();
  });

  it("rejects owner spoofing and duplicate ids", () => {
    const builtIn = matchingDetector(D6_NEXUS_MATCHING_DETECTOR_ID);
    if (!builtIn) throw new Error("fixture missing");
    expect(() =>
      matchingEvaluatorRegistry.register("intruder", {
        ...builtIn,
        id: "intruder.matches",
        evaluator: {
          ...builtIn.evaluator,
          id: "intruder.matches",
          source: { kind: "module", ownerId: "someone-else" },
        },
      }),
    ).toThrow(/owner/u);
    expect(() =>
      matchingEvaluatorRegistry.register("d6-system-2e", builtIn),
    ).toThrow(/already registered/u);
  });
});
