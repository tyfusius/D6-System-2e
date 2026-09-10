import { describe, expect, it } from "vitest";
import {
  createFirstEditionRelativeMovement,
  parseFirstEditionRelativeMovement,
  advanceFirstEditionRelativeMovement,
} from "./first-edition-relative-movement";
import {
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "./first-edition-action-root";
function fixture() {
  return createFirstEditionRelativeMovement({
    rootMessageId: "root",
    operationId: "movement",
    coordinatorUserId: "gm",
    controllerUserId: "owner",
    subject: {
      actorId: "actor",
      actorUuid: "Actor.actor",
      sceneId: "scene",
      tokenUuid: "Scene.scene.Token.token",
    },
    combat: {
      uuid: "Combat.combat",
      combatantUuid: "Combat.combat.Combatant.c",
      revision: 2,
    },
    runtime: {
      profileId: "first-edition",
      movementStrategyId: "open-d6.movement.relative",
      actionEconomyStrategyId: "economy",
    },
    source: { attributeId: "agility" },
    planInput: { type: "land", baseMove: 10, distance: 8 },
    spend: {
      kind: "action-spend",
      actorUuid: "Actor.actor",
      combatUuid: "Combat.combat",
      combatantUuid: "Combat.combat.Combatant.c",
      expectedRevision: 2,
      actions: { value: 1, unit: "actions" },
    },
    translation: {
      kind: "token-translation",
      actorUuid: "Actor.actor",
      sceneId: "scene",
      tokenUuid: "Scene.scene.Token.token",
      from: { x: 0, y: 0, unit: "pixels" },
      to: { x: 800, y: 0, unit: "pixels" },
      distance: { value: 8, unit: "meters" },
      measurement: { sceneUnits: "m", gridSize: 100, gridDistance: 1 },
    },
  });
}
describe("narrow relative Movement program", () => {
  it("requires acknowledged spending before it offers translation", () => {
    const value = fixture();
    expect(advanceFirstEditionRelativeMovement(value)).toEqual(value);
    const stage = value.action.stages[0];
    if (stage?.spec.kind !== "effect") throw Error("stage");
    const claimed = claimFirstEditionActionStage(
      value.action,
      stage.id,
      "owner",
      { kind: "effect" },
    );
    expect(
      advanceFirstEditionRelativeMovement({ ...value, action: claimed }).action
        .stages,
    ).toHaveLength(1);
    const recorded = recordFirstEditionActionStage(claimed, stage.id, {
      kind: "effect",
      plan: stage.spec.plan,
      receiptKey: `${stage.id}:effect`,
      authorityReceiptId: "saved",
      outcome: "applied",
    });
    expect(
      advanceFirstEditionRelativeMovement({ ...value, action: recorded }).action
        .stages[1]?.spec,
    ).toMatchObject({ kind: "effect", plan: { kind: "token-translation" } });
  });
  it("rejects mismatched Combat revision/UUID and Actor/Token binding", () => {
    const value = fixture();
    for (const combat of [
      { ...value.combat, revision: 3 },
      { ...value.combat, uuid: "Combat.other" },
      { ...value.combat, combatantUuid: "Combat.combat.Combatant.other" },
    ])
      expect(
        parseFirstEditionRelativeMovement({ ...value, combat }),
      ).toBeNull();
    for (const translation of [
      { ...value.translation, tokenUuid: "Scene.other.Token.token" },
      { ...value.translation, actorUuid: "Actor.other" },
      { ...value.translation, sceneId: "other" },
    ])
      expect(
        parseFirstEditionRelativeMovement({ ...value, translation }),
      ).toBeNull();
  });
  it("rejects a rewritten plan, extra stage, alternate controller and premature completion", () => {
    const value = fixture(),
      stage = value.action.stages[0];
    if (!stage) throw Error("stage");
    expect(
      parseFirstEditionRelativeMovement({
        ...value,
        plan: { ...value.plan, difficulty: 99 },
      }),
    ).toBeNull();
    expect(
      parseFirstEditionRelativeMovement({
        ...value,
        action: { ...value.action, status: "complete" },
      }),
    ).toBeNull();
    expect(
      parseFirstEditionRelativeMovement({
        ...value,
        action: {
          ...value.action,
          stages: [stage, { ...stage, id: "unrelated" }],
        },
      }),
    ).toBeNull();
    expect(
      parseFirstEditionRelativeMovement({
        ...value,
        action: {
          ...value.action,
          subjects: [
            {
              ...value.action.subjects[0],
              actor: { actorId: "actor", actorUuid: "Actor.other" },
            },
          ],
        },
      }),
    ).toBeNull();
  });
});
