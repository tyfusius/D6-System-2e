import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollRequestV1,
} from "@d6-system-2e/core";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { completedUnrollableExtraordinaryPowerResult } from "./extraordinary-power-unrollable-result";

const rollService = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);

function request(): D6RollRequestV1 {
  return {
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    context: {
      extraordinaryPower: {
        checkCount: 2,
        checkIndex: 2,
        frameworkId: "star-wars.force",
        frameworkPenaltyScore: 3,
        maintainedPowerCount: 0,
        powerId: "custom-roll-plan",
        roleId: "sense",
      },
    },
    difficulty: 10,
    heroPointUse: "double-die-code",
    kind: "skill",
    label: "Blank sequence · Sense",
    resultModifier: 0,
    rollMode: "publicroll",
    score: 0,
    source: {
      actorId: "force-user",
      actorName: "Force User Test",
      attributeId: "perception",
      itemId: "sense-skill",
    },
  };
}

describe("unrollable extraordinary-power checks", () => {
  it("opts only Force sequences into completed below-1D failures", () => {
    const sequence = rollService.slice(
      rollService.indexOf("export async function rollExtraordinaryPowerSkill("),
      rollService.indexOf(
        "export async function rollExtraordinaryPowerSkillDirect(",
      ),
    );
    const direct = rollService.slice(
      rollService.indexOf(
        "export async function rollExtraordinaryPowerSkillDirect(",
      ),
      rollService.indexOf("async function executeExtraordinaryPowerSkillRoll("),
    );
    expect(sequence).toContain("difficulty,\n    true,");
    expect(direct).not.toContain("true");
    expect(rollService).toContain(
      "options.completeBelowOneDieAsFailure === true",
    );
    expect(rollService).toContain(
      "completedUnrollableExtraordinaryPowerResult(",
    );
  });

  it("records a below-1D sequence check as a completed failed zero-dice result", () => {
    const result = completedUnrollableExtraordinaryPowerResult(
      request(),
      "star-wars.first-edition",
      "first-edition",
    );
    expect(result).toMatchObject({
      baseFaces: [],
      difficulty: { difficulty: 10, score: 0, success: false },
      heroPointSpent: 0,
      pool: { code: { dice: 0, pips: 0 }, wildDice: 0 },
      profileId: "star-wars.first-edition",
      request: {
        context: {
          extraordinaryPower: {
            checkCount: 2,
            checkIndex: 2,
            frameworkPenaltyScore: 3,
            roleId: "sense",
          },
        },
        heroPointUse: "none",
        rollMode: "publicroll",
        score: 0,
      },
      success: false,
      total: 0,
      wildFaces: [],
      wildPolicy: "first-edition",
      wildOutcome: "failure",
    });
  });

  it("rejects use outside an extraordinary-power sequence", () => {
    const ordinary = { ...request() };
    delete ordinary.context;
    expect(() =>
      completedUnrollableExtraordinaryPowerResult(
        ordinary,
        "default",
        "second-edition",
      ),
    ).toThrow("RollContextRequired");
  });
});
