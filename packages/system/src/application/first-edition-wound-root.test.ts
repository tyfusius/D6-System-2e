import { requireDestinyValue as required } from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import {
  resolveD6Roll,
  type D6RollRequestV1,
  type FirstEditionWoundLevel,
} from "@d6-system-2e/core";
import {
  createFirstEditionWoundRoot,
  advanceFirstEditionWoundRoot,
  parseFirstEditionWoundRoot,
  woundRootOutcome,
  type FirstEditionWoundRoot,
  type WoundOperation,
} from "./first-edition-wound-root";
import {
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "./first-edition-action-root";

function root(
  operation: WoundOperation = "natural",
  wound: FirstEditionWoundLevel = "wounded",
  minutes = 1,
) {
  return createFirstEditionWoundRoot({
    rootMessageId: "abcdefghijklmnop",
    controllerUserId: "owner",
    coordinatorUserId: "gm",
    patient: { actorId: "patient", actorUuid: "Actor.patient" },
    ...(operation === "assisted"
      ? { healer: { actorId: "healer", actorUuid: "Actor.healer" } }
      : {}),
    source: {
      attributeId: "brawn",
      ...(operation === "assisted" ? { itemId: "medicine" } : {}),
    },
    runtime: {
      profileId: "first-edition",
      healthModelId: "open-d6.health.wound-track",
      damageStrategyId: "open-d6.damage.wounds",
      ...(operation === "round-mortality"
        ? { roundLifecycleId: "open-d6.elapsed-rounds" }
        : {}),
    },
    operation,
    wound,
    ...(operation.includes("mortality") ? { minutes } : {}),
    ...(operation === "round-mortality"
      ? {
          clock: {
            checkId: "combat:round:12",
            combatUuid: "Combat.combat",
            completedRounds: { value: 12, unit: "rounds" as const },
            elapsedMinutes: { value: minutes, unit: "minutes" as const },
          },
        }
      : {}),
  });
}
function checked(
  value: FirstEditionWoundRoot,
  total: number,
  complication = false,
) {
  const stage = required(value.action.stages[0]);
  if (stage.spec.kind !== "d6-roll") throw Error("check required");
  const request: D6RollRequestV1 = {
    contractVersion: 2,
    kind: stage.spec.source.itemId ? "skill" : "attribute",
    label: "Healing",
    score: 6,
    resultModifier: total - (complication ? 5 : 6),
    heroPointUse: "none",
    rollMode: "selfroll",
    ...("fixedDifficulty" in stage.spec
      ? { difficulty: stage.spec.fixedDifficulty }
      : {}),
    source: {
      ...stage.spec.subject,
      ...stage.spec.source,
      actorName: "Patient",
    },
    ...(value.action.clock
      ? {
          context: {
            firstEditionMortality: {
              checkId: value.action.clock.checkId,
              completedRounds: value.action.clock.completedRounds.value,
              elapsedMinutes: value.action.clock.elapsedMinutes.value,
              sourcePage: 76,
            },
          },
        }
      : {}),
  };
  const runtime = {
    profileId: "first-edition",
    successEvaluator: "first-edition-meets" as const,
    wildPolicy: "first-edition" as const,
  };
  const faces = complication ? [4, 1] : [4, 2];
  const result = resolveD6Roll({
    ...runtime,
    request,
    ...(complication ? { choice: "first-edition-complication" as const } : {}),
    baseFaces: [required(faces[0])],
    wildFaces: [required(faces[1])],
  });
  const action = claimFirstEditionActionStage(value.action, stage.id, "owner", {
    kind: "d6-roll",
    request,
    runtime,
  });
  return {
    ...value,
    action: recordFirstEditionActionStage(action, stage.id, {
      kind: "d6-roll",
      result,
      artifacts: [
        {
          version: 1,
          serialized: JSON.stringify({ faces }),
          evidence: {
            formula: "2d6",
            faces,
            total: required(faces[0]) + required(faces[1]),
            fingerprint: "a".repeat(64),
          },
        },
      ],
    }),
  };
}
describe("Wound initiating roots", () => {
  it("records Stunned rest as an effect without creating a check", () => {
    const value = root("natural", "stunned");
    expect(parseFirstEditionWoundRoot(value)).toEqual(value);
    expect(value.action.stages).toHaveLength(1);
    expect(value.action.stages[0]?.spec).toMatchObject({
      kind: "effect",
      plan: {
        after: { stateId: "healthy" },
        rest: { value: 1, unit: "minutes" },
      },
    });
  });
  it.each([
    ["wounded", 6, "healthy"],
    ["severely-wounded", 6, "wounded"],
    ["incapacitated", 8, "severely-wounded"],
    ["mortally-wounded", 8, "incapacitated"],
  ] as const)("preserves natural %s threshold %i", (wound, total, after) => {
    const value = root("natural", wound);
    expect(value.action.stages[0]?.spec).not.toHaveProperty("fixedDifficulty");
    expect(woundRootOutcome(checked(value, total - 1))?.nextWound).toBe(wound);
    const saved = checked(value, total);
    expect(woundRootOutcome(saved)?.nextWound).toBe(after);
    const advanced = advanceFirstEditionWoundRoot(saved);
    expect(parseFirstEditionWoundRoot(advanced)).toEqual(advanced);
    expect(advanced.action.stages[1]?.spec).toMatchObject({
      kind: "effect",
      plan: { after: { stateId: after } },
    });
  });
  it("uses different Wounded natural and assisted destinations", () => {
    expect(
      woundRootOutcome(checked(root("assisted", "wounded"), 15))?.nextWound,
    ).toBe("stunned");
    expect(
      root("assisted", "mortally-wounded").action.stages[0]?.spec,
    ).toMatchObject({
      fixedDifficulty: 25,
      subject: { actorUuid: "Actor.healer" },
    });
  });
  it("records the configured category increase for self-treatment", () => {
    const value = createFirstEditionWoundRoot({
      rootMessageId: "selftreatment001",
      controllerUserId: "owner",
      coordinatorUserId: "gm",
      patient: { actorId: "patient", actorUuid: "Actor.patient" },
      healer: { actorId: "patient", actorUuid: "Actor.patient" },
      source: { attributeId: "technical", itemId: "medicine" },
      runtime: {
        profileId: "first-edition",
        healthModelId: "open-d6.health.wound-track",
        damageStrategyId: "open-d6.damage.wounds",
      },
      operation: "assisted",
      wound: "wounded",
      selfTreatment: true,
      difficultyLadder: [
        { id: "very-easy", label: "Very Easy", value: 5 },
        { id: "easy", label: "Easy", value: 10 },
        { id: "moderate", label: "Moderate", value: 15 },
        { id: "difficult", label: "Difficult", value: 23 },
        { id: "very-difficult", label: "Very Difficult", value: 30 },
        { id: "heroic", label: "Heroic", value: 35 },
      ],
    });
    expect(value.action.stages[0]?.spec).toMatchObject({ fixedDifficulty: 23 });
    expect(value.treatmentAudit).toEqual({
      baseCategory: "moderate",
      baseValue: 15,
      finalCategory: "difficult",
      finalValue: 23,
      selfTreatment: true,
      treatmentFamily: "open-d6-space",
    });
    expect(parseFirstEditionWoundRoot(value)).toEqual(value);
  });
  it("only natural complications worsen wounds", () => {
    expect(
      woundRootOutcome(checked(root("natural", "wounded"), 20, true))
        ?.nextWound,
    ).toBe("severely-wounded");
    expect(
      woundRootOutcome(checked(root("assisted", "wounded"), 20, true))
        ?.nextWound,
    ).toBe("stunned");
    expect(
      woundRootOutcome(checked(root("natural", "mortally-wounded"), 20, true))
        ?.nextWound,
    ).toBe("dead");
  });
  it.each(["manual-mortality", "round-mortality"] as const)(
    "preserves %s equality and lower-total death",
    (operation) => {
      expect(
        woundRootOutcome(checked(root(operation, "mortally-wounded", 4), 4))
          ?.outcome,
      ).toBe("survived");
      expect(
        woundRootOutcome(checked(root(operation, "mortally-wounded", 4), 3))
          ?.outcome,
      ).toBe("dead");
    },
  );
  it("rejects future versions, altered effects, legacy cards and invalid manual time", () => {
    const value = advanceFirstEditionWoundRoot(checked(root(), 6));
    expect(parseFirstEditionWoundRoot({ ...value, version: 2 })).toBeNull();
    expect(
      parseFirstEditionWoundRoot({ kind: "firstEditionHealing", version: 1 }),
    ).toBeNull();
    const tampered = JSON.parse(JSON.stringify(value)) as {
      action: { stages: { spec: { plan: { after: { stateId: string } } } }[] };
    };
    required(tampered.action.stages[1]).spec.plan.after.stateId = "dead";
    expect(parseFirstEditionWoundRoot(tampered)).toBeNull();
    expect(() => root("manual-mortality", "mortally-wounded", 0)).toThrow();
  });
  it("cannot advance pending or claimed checks into effects", () => {
    const value = root();
    expect(advanceFirstEditionWoundRoot(value)).toEqual(value);
    expect(woundRootOutcome(value)).toBeNull();
  });
});
