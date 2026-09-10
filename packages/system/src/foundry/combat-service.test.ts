import * as privateCombat from "./combat-round-private";
import * as destinyCrypto from "./destiny-crypto";
import {
  createCombatantRoundState,
  commitFirstEditionActions,
} from "@d6-system-2e/core";
import * as rulesProfiles from "../settings/rules-profile-library";
import { firstEditionGenreProfileRegistry } from "../registries/first-edition-genre-profiles";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  combatDeclarationOptions,
  annotateCombatantNextAction,
  commitFirstEditionCombatantActions,
  completeNextCombatantAction,
  declareCombatantActions,
  enterSecondEditionCombatantFullDefense,
  forfeitWoundedCombatantActions,
  readCombatantRound,
  recordFirstEditionCombatantDefense,
  recordFirstEditionCombatantSegmentMovement,
  resetCombatantActions,
  spendFirstEditionCombatantAction,
} from "./combat-service";

import { executePrivateCombatCommand } from "./combat-round-grid-service";

let actionEconomyStrategy = "second-edition-action-segments";
let defenseStrategy = "d6e2.defenses.static";
let segmentedScheduling = false;
let movementStrategy = "d6e2.movement.segmented";

vi.mock("../settings/optional-capabilities", () => ({
  currentOptionalCapabilityRuntime: () => ({
    environments: { state: "inactive" },
  }),
}));

vi.mock("../settings/defenses", () => ({
  currentDefenseRuntimeStrategy: () =>
    defenseStrategy === "d6mv.defenses.srp"
      ? {
          activeDefense: "unsupported",
          family: "srp",
          feint: "unsupported",
          fullDefense: "d6mv-resistance-skill-bonus",
          id: defenseStrategy,
          reaction: "declared-only",
          targeting: "actor-static",
        }
      : defenseStrategy === "open-d6.defenses.active"
        ? {
            activeDefense: "committed-roll",
            family: "active",
            feint: "unsupported",
            fullDefense: "open-d6-plus-ten",
            id: defenseStrategy,
            reaction: "triggered-interrupt",
            targeting: "manual",
          }
        : {
            activeDefense: "unsupported",
            family: "static",
            feint: "second-edition-penalty",
            fullDefense: "second-edition-skill-bonus",
            id: defenseStrategy,
            reaction: "declared-only",
            targeting: "actor-static",
          },
}));

vi.mock("../settings/action-economy", () => ({
  currentActionEconomyRuntimeStrategy: () =>
    actionEconomyStrategy === "open-d6-flexible-action-allotment"
      ? {
          declaration: "action-commitment",
          freshWound: "preserve-actions",
          penalty: "planned-actions-minus-allotment",
          reaction: "triggered-interrupt",
          turnScheduling: segmentedScheduling
            ? "round-robin-segments"
            : "free-commitment",
        }
      : {
          declaration: "ordered-actions",
          freshWound: "forfeit-remaining",
          penalty: "declared-actions-minus-one",
          reaction: "declared-only",
          turnScheduling: "combatant-action-order",
        },
}));

vi.mock("../settings/movement", () => ({
  currentMovementRuntimeStrategy: () =>
    movementStrategy === "open-d6.movement.segmented"
      ? {
          distance: "relative-rate",
          family: "relative",
          id: movementStrategy,
          posture: "untracked",
          reactive: "consume-next-action-no-chain",
          segment: "round-robin-rate",
        }
      : {
          distance: "fixed-mode",
          family: "segmented",
          id: movementStrategy,
          posture: "standing-prone",
          reactive: "unsupported",
          segment: "declared-action",
        },
}));

vi.mock("../settings/campaign-profile", () => ({
  currentSecondEditionCampaignProfile: () => ({
    activeResponsiveCombat: true,
  }),
}));

vi.mock("../settings/pip-rules", () => ({
  currentCombinedPipScore: (...scores: number[]) =>
    scores.reduce((total, score) => total + score, 0),
  currentEffectivePipScore: (score: number) => score,
}));

const flags = new Map<string, unknown>();
const updates: Record<string, unknown>[] = [];
const actorUpdates: Record<string, unknown>[] = [];
const combatant = {
  actor: null as object | null,
  actorId: "actor-1",
  id: "combatant-1",
  getFlag: (_namespace: string, key: string) => flags.get(key),
  update: (changes: Record<string, unknown>) => {
    updates.push(changes);
    const state = changes["flags.d6-system-2e.roundAction"];
    flags.set("roundAction", state);
    return Promise.resolve();
  },
};
const actor = {
  id: "actor-1",
  isOwner: true,
  items: {
    contents: [
      {
        id: "dodge",
        name: "Dodge",
        system: {
          attributeId: "perception",
          key: "dodge",
          score: 0,
          training: "standard",
        },
        type: "skill",
      },
      {
        id: "reflex",
        name: "Reflex",
        system: {
          attributeId: "agility",
          key: "reflex",
          score: 3,
          training: "standard",
        },
        type: "skill",
      },
      {
        id: "instinct",
        name: "Instinct",
        system: {
          attributeId: "perception",
          key: "instinct",
          score: 6,
          training: "standard",
        },
        type: "skill",
      },
      {
        id: "grit",
        name: "Grit",
        system: {
          attributeId: "charm",
          key: "grit",
          score: 3,
          training: "standard",
        },
        type: "skill",
      },
      {
        id: "blaster",
        name: "Blaster",
        system: {
          attackAttributeId: "agility",
          attackBonus: 0,
          attackSkillKey: "",
          equipped: true,
        },
        type: "weapon",
      },
      {
        id: "holstered-blaster",
        name: "Holstered Blaster",
        system: {
          attackAttributeId: "agility",
          attackBonus: 0,
          attackSkillKey: "",
          equipped: false,
        },
        type: "weapon",
      },
    ],
  },
  system: {
    attributes: {
      agility: { score: 9 },
      charm: { score: 12 },
      perception: { score: 9 },
    },
    health: { condition: "healthy" },
    movement: { posture: "standing" },
  },
  uuid: "Scene.scene-1.Token.token-1.Actor.actor-1",
  update: (changes: Record<string, unknown>) => {
    actorUpdates.push(changes);
    const posture = changes["system.movement.posture"];
    if (posture === "standing" || posture === "prone") {
      actor.system.movement.posture = posture;
    }
    return Promise.resolve();
  },
};

beforeEach(() => {
  flags.clear();
  updates.length = 0;
  actorUpdates.length = 0;
  actor.system.movement.posture = "standing";
  actor.system.health.condition = "healthy";
  actionEconomyStrategy = "second-edition-action-segments";
  defenseStrategy = "d6e2.defenses.static";
  segmentedScheduling = false;
  movementStrategy = "d6e2.movement.segmented";
  combatant.actor = actor;
  vi.stubGlobal("game", {
    combat: { combatants: { contents: [combatant] }, round: 2 },
    i18n: { localize: (key: string) => key },
    user: { isGM: false },
  });
});

describe("Foundry combatant action commands", () => {
  it("does not treat a base Actor as an unlinked synthetic Token combatant", () => {
    const baseActor = {
      ...actor,
      system: { movement: { posture: "standing" } },
      uuid: "Actor.actor-1",
    };
    const resolvedSyntheticActor = {
      ...actor,
      system: { movement: { posture: "standing" } },
    };
    combatant.actor = resolvedSyntheticActor;
    expect(readCombatantRound(baseActor)).toBeNull();
    expect(readCombatantRound(actor)).toMatchObject({
      defenseFamily: "static",
      defenseStrategyId: "d6e2.defenses.static",
      defenseTargeting: "actor-static",
      movementFamily: "segmented",
      movementPosture: "standing-prone",
      movementStrategyId: "d6e2.movement.segmented",
      reactiveMovement: "unsupported",
      active: true,
      actorId: "actor-1",
    });
  });

  it("declares, reads, and advances revision-checked action state", async () => {
    await declareCombatantActions(actor, {
      actions: [
        { kind: "move", label: "Move" },
        {
          kind: "attack",
          label: "Attack",
          sourceId: "blaster",
        },
      ],
      expectedRevision: 0,
    });
    expect(readCombatantRound(actor)).toMatchObject({
      currentAction: { label: "Move" },
      penaltyLabel: "−1D",
      revision: 1,
      round: 2,
    });
    await completeNextCombatantAction(actor, 1);
    expect(readCombatantRound(actor)).toMatchObject({
      completedActionIds: ["2-1-1"],
      currentAction: { label: "Blaster" },
      revision: 2,
    });
    expect(updates).toHaveLength(2);
  });

  it("locks the current Second Edition round when the combatant becomes Wounded", async () => {
    await declareCombatantActions(actor, {
      actions: [
        { kind: "other", label: "Take cover" },
        { kind: "attack", label: "Attack", sourceId: "blaster" },
      ],
      expectedRevision: 0,
    });
    await completeNextCombatantAction(actor, 1);

    await expect(forfeitWoundedCombatantActions(actor)).resolves.toMatchObject({
      changed: true,
      state: {
        actionForfeiture: { reason: "wounded", sourcePage: 33 },
        complete: true,
        completedActionIds: ["2-1-1"],
        revision: 3,
      },
    });
    await expect(forfeitWoundedCombatantActions(actor)).resolves.toMatchObject({
      changed: false,
      state: { revision: 3 },
    });
    await expect(
      declareCombatantActions(actor, {
        actions: [{ kind: "other", label: "Replacement" }],
        expectedRevision: 3,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.DeclarationLocked");
  });

  it("does not apply the Second Edition wound lock to First Edition actions", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    const result = await forfeitWoundedCombatantActions(actor);
    expect(result.changed).toBe(false);
    expect(result.state).not.toHaveProperty("actionForfeiture");
    expect(updates).toEqual([]);
  });

  it("rejects stale commands and player resets after resolution begins", async () => {
    await declareCombatantActions(actor, {
      actions: [{ kind: "skill", label: "Dodge", sourceId: "dodge" }],
      expectedRevision: 0,
    });
    await expect(completeNextCombatantAction(actor, 0)).rejects.toThrow(
      "D6E2.Combat.Error.RevisionConflict",
    );
    await completeNextCombatantAction(actor, 1);
    await expect(resetCombatantActions(actor, 2)).rejects.toThrow(
      "D6E2.Combat.Error.ResetRequiresGM",
    );
  });

  it("persists typed running movement and includes its extra penalty", async () => {
    await declareCombatantActions(actor, {
      actions: [
        {
          kind: "move",
          label: "Run",
          movementMode: "run",
        },
        {
          kind: "attack",
          label: "Attack",
          sourceId: "blaster",
        },
      ],
      expectedRevision: 0,
    });
    expect(readCombatantRound(actor)).toMatchObject({
      actions: [
        { kind: "move", label: "Run", movementMode: "run" },
        {
          baseScore: 9,
          effectiveScore: 3,
          kind: "attack",
          label: "Blaster",
          sourceId: "blaster",
        },
      ],
      penaltyLabel: "−2D",
      penaltyScore: 6,
    });
  });

  it("excludes inactive schema defaults only for an explicitly bound genre declaration", () => {
    const owner = "declaration-bound-genre";
    const ids = [
      "reflexes",
      "coordination",
      "physique",
      "knowledge",
      "perception",
      "presence",
    ];
    firstEditionGenreProfileRegistry.register(owner, {
      version: 1,
      id: owner,
      genreId: owner,
      label: "Bound declaration",
      attributes: ids.map((id) => ({ id, label: id })),
      roles: {
        initiative: "perception",
        knowledge: "knowledge",
        strength: "physique",
      },
      attributeBudgetScore: 54,
      skillBudgetScore: 21,
      skills: [],
    });
    const profile = rulesProfiles.normalizeRulesProfile({
      id: "bound-declaration",
      firstEditionGenreProfile: { version: 1, id: owner },
      strategies: { attributes: "open-d6.attributes.six-attribute" },
    });
    const read = vi
      .spyOn(rulesProfiles, "currentConfiguredRulesProfile")
      .mockReturnValue(profile);
    const subject = {
      system: {
        attributes: {
          agility: { score: 3 },
          brawn: { score: 3 },
          ...Object.fromEntries(ids.map((id) => [id, { score: 9 }])),
        },
      },
    };
    const before = structuredClone(subject);
    try {
      expect(
        combatDeclarationOptions(subject)
          .filter((o) => o.kind === "attribute")
          .map((o) => o.sourceId)
          .sort(),
      ).toEqual([...ids].sort());
      expect(subject).toEqual(before);
      read.mockReturnValue(
        rulesProfiles.normalizeRulesProfile({ id: "unbound-declaration" }),
      );
      expect(
        combatDeclarationOptions(subject)
          .filter((o) => o.kind === "attribute")
          .map((o) => o.sourceId),
      ).toEqual(expect.arrayContaining(["agility", "brawn"]));
      read.mockReturnValue(profile);
      firstEditionGenreProfileRegistry.unregisterOwner(owner);
      expect(() => combatDeclarationOptions(subject)).toThrow("unavailable");
      expect(subject).toEqual(before);
    } finally {
      read.mockRestore();
      firstEditionGenreProfileRegistry.unregisterOwner(owner);
    }
  });

  it("projects authoritative Attribute, Skill, and weapon declaration pools", () => {
    const options = combatDeclarationOptions(actor);
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "attribute",
          score: 9,
          sourceId: "agility",
        }),
        expect.objectContaining({
          kind: "skill",
          score: 9,
          sourceId: "dodge",
        }),
        expect.objectContaining({
          kind: "attack",
          score: 9,
          sourceId: "blaster",
        }),
      ]),
    );
    expect(options).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: "holstered-blaster" }),
      ]),
    );
  });

  it("rejects a forged declaration for an unequipped weapon", async () => {
    await expect(
      declareCombatantActions(actor, {
        actions: [
          {
            kind: "attack",
            label: "Holstered Blaster",
            sourceId: "holstered-blaster",
          },
        ],
        expectedRevision: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.InvalidActionSource");
  });

  it("prevents a 3D attack from being declared as one of four actions", async () => {
    await expect(
      declareCombatantActions(actor, {
        actions: Array.from({ length: 4 }, () => ({
          kind: "attack" as const,
          label: "Attack",
          sourceId: "blaster",
        })),
        expectedRevision: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.DeclarationPoolBelowOneDie");
    expect(updates).toEqual([]);
  });

  it("includes the wound penalty and rejects conditions that cannot act", async () => {
    actor.system.health.condition = "wounded";
    await expect(
      declareCombatantActions(actor, {
        actions: [
          {
            kind: "move",
            label: "Run",
            movementMode: "run",
          },
          {
            kind: "attack",
            label: "Attack",
            sourceId: "blaster",
          },
        ],
        expectedRevision: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.DeclarationPoolBelowOneDie");

    actor.system.health.condition = "stunned";
    await expect(
      declareCombatantActions(actor, {
        actions: [{ kind: "other", label: "Wait" }],
        expectedRevision: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.ConditionCannotAct");
  });

  it("applies the declared movement posture when that action completes", async () => {
    await declareCombatantActions(actor, {
      actions: [
        {
          endProne: true,
          kind: "move",
          label: "Run",
          movementMode: "run",
        },
      ],
      expectedRevision: 0,
    });
    await completeNextCombatantAction(actor, 1);
    expect(actorUpdates).toEqual([{ "system.movement.posture": "prone" }]);
    expect(readCombatantRound(actor)?.actions[0]).toMatchObject({
      endProne: true,
      movementMode: "run",
    });
  });

  it("starts a clean logical state when Foundry advances the round", async () => {
    await declareCombatantActions(actor, {
      actions: [{ kind: "other", label: "Wait" }],
      expectedRevision: 0,
    });
    vi.stubGlobal("game", {
      combat: { combatants: { contents: [combatant] }, round: 3 },
      i18n: { localize: (key: string) => key },
      user: { isGM: false },
    });
    expect(readCombatantRound(actor)).toMatchObject({
      actions: [],
      completedActionIds: [],
      revision: 0,
      round: 3,
    });
  });

  it("enforces interleaved initiative order for queued First Edition actions", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    segmentedScheduling = true;
    const secondFlags = new Map<string, unknown>();
    const secondActor = {
      ...actor,
      id: "actor-2",
      name: "Second Actor",
      uuid: "Scene.scene-1.Token.token-2.Actor.actor-2",
    };
    const secondCombatant = {
      actor: secondActor,
      actorId: "actor-2",
      id: "combatant-2",
      getFlag: (_namespace: string, key: string) => secondFlags.get(key),
      update: (changes: Record<string, unknown>) => {
        secondFlags.set(
          "roundAction",
          changes["flags.d6-system-2e.roundAction"],
        );
        return Promise.resolve();
      },
    };
    vi.stubGlobal("game", {
      combat: {
        combatants: { contents: [combatant, secondCombatant] },
        round: 2,
        turns: [combatant, secondCombatant],
      },
      i18n: { localize: (key: string) => key },
      settings: { get: () => true },
      user: { isGM: false },
    });

    await commitFirstEditionCombatantActions(actor, {
      actionAllotment: 1,
      actions: [
        { kind: "attack", label: "Blaster", sourceId: "blaster" },
        { kind: "other", label: "Take cover" },
      ],
      defense: "none",
      expectedRevision: 0,
      plannedActionCount: 2,
      spentActionCount: 0,
    });
    expect(readCombatantRound(actor)).toMatchObject({
      firstEditionSegmentReady: false,
      firstEditionSegmentWaitingLabels: ["Second Actor"],
    });
    await expect(spendFirstEditionCombatantAction(actor, 1)).rejects.toThrow(
      "D6E2.Combat.Error.FirstEditionQueueIncomplete",
    );
    await commitFirstEditionCombatantActions(secondActor, {
      actionAllotment: 1,
      actions: [{ kind: "other", label: "Watch" }],
      defense: "none",
      expectedRevision: 0,
      plannedActionCount: 1,
      spentActionCount: 0,
    });
    await expect(
      spendFirstEditionCombatantAction(secondActor, 1),
    ).rejects.toThrow("D6E2.Combat.Error.FirstEditionSegmentTurn");
    await spendFirstEditionCombatantAction(actor, 1);
    expect(readCombatantRound(secondActor)).toMatchObject({
      firstEditionCurrentSegment: 1,
      firstEditionNextCombatantId: "combatant-2",
    });
    await spendFirstEditionCombatantAction(secondActor, 1);
    expect(readCombatantRound(actor)).toMatchObject({
      firstEditionCurrentSegment: 2,
      firstEditionNextCombatantId: "combatant-1",
    });
  });

  it("rejects a linked First Edition queue action reduced below 1D", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    await expect(
      commitFirstEditionCombatantActions(actor, {
        actionAllotment: 1,
        actions: [
          { kind: "attack", label: "Blaster", sourceId: "blaster" },
          { kind: "other", label: "Wait" },
          { kind: "other", label: "Watch" },
          { kind: "other", label: "Take cover" },
        ],
        defense: "none",
        expectedRevision: 0,
        plannedActionCount: 4,
        spentActionCount: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.DeclarationPoolBelowOneDie");
  });

  it("persists and spends a First Edition pre-turn defense commitment", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    await commitFirstEditionCombatantActions(actor, {
      actionAllotment: 1,
      defense: "partial-defense",
      expectedRevision: 0,
      plannedActionCount: 2,
      spentActionCount: 1,
    });
    expect(readCombatantRound(actor)).toMatchObject({
      actions: [{ label: "Action 1" }, { label: "Action 2" }],
      completedActionIds: ["2-1-first-edition-1"],
      firstEditionActionPenaltyScore: 3,
      firstEditionCommitment: {
        defense: "partial-defense",
        plannedActionCount: 2,
        spentActionCount: 1,
      },
      firstEditionRemainingActionCount: 1,
      revision: 1,
    });
    await spendFirstEditionCombatantAction(actor, 1);
    expect(readCombatantRound(actor)).toMatchObject({
      firstEditionRemainingActionCount: 0,
      revision: 2,
    });
    await expect(
      commitFirstEditionCombatantActions(actor, {
        actionAllotment: 1,
        defense: "none",
        expectedRevision: 2,
        plannedActionCount: 1,
        spentActionCount: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.DeclarationLocked");
  });

  it("persists an explicit clear when the GM resets First Edition state", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    await commitFirstEditionCombatantActions(actor, {
      actionAllotment: 1,
      defense: "partial-defense",
      expectedRevision: 0,
      plannedActionCount: 2,
      spentActionCount: 1,
    });
    vi.stubGlobal("game", {
      combat: { combatants: { contents: [combatant] }, round: 2 },
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });

    await resetCombatantActions(actor, 1);

    expect(updates.at(-1)?.["flags.d6-system-2e.roundAction"]).toMatchObject({
      firstEditionCommitment: null,
      revision: 2,
    });
    const resetState = readCombatantRound(actor);
    expect(resetState).not.toHaveProperty("firstEditionCommitment");
    expect(resetState).toMatchObject({
      firstEditionRemainingActionCount: 0,
      revision: 2,
    });
  });

  it("records an authoritative typed First Edition defense and clears it on recommit", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    defenseStrategy = "open-d6.defenses.active";
    await commitFirstEditionCombatantActions(actor, {
      actionAllotment: 1,
      defense: "partial-defense",
      expectedRevision: 0,
      plannedActionCount: 2,
      spentActionCount: 0,
    });
    await recordFirstEditionCombatantDefense(actor, {
      consumeAction: true,
      difficulty: 13,
      expectedRevision: 1,
      kind: "dodge",
      label: "Dodge",
      mode: "partial",
      sourceId: "dodge",
      total: 13,
    });
    expect(readCombatantRound(actor)).toMatchObject({
      firstEditionActiveDefense: {
        difficulty: 13,
        kind: "dodge",
        mode: "partial",
      },
      firstEditionCommitment: { spentActionCount: 1 },
      revision: 2,
    });

    vi.stubGlobal("game", {
      combat: { combatants: { contents: [combatant] }, round: 2 },
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });
    await commitFirstEditionCombatantActions(actor, {
      actionAllotment: 1,
      defense: "full-defense",
      expectedRevision: 2,
      plannedActionCount: 1,
      spentActionCount: 0,
    });
    expect(updates.at(-1)?.["flags.d6-system-2e.roundAction"]).toMatchObject({
      firstEditionActiveDefense: null,
    });
    expect(readCombatantRound(actor)).not.toHaveProperty(
      "firstEditionActiveDefense",
    );
  });

  it("rejects active defenses under a static defense strategy", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    await commitFirstEditionCombatantActions(actor, {
      actionAllotment: 1,
      defense: "partial-defense",
      expectedRevision: 0,
      plannedActionCount: 1,
      spentActionCount: 0,
    });
    await expect(
      recordFirstEditionCombatantDefense(actor, {
        consumeAction: true,
        difficulty: 10,
        expectedRevision: 1,
        kind: "dodge",
        label: "Dodge",
        mode: "partial",
        sourceId: "dodge",
        total: 10,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.FirstEditionActiveDefensesInactive");
  });

  it("rejects Second Edition full defense under an active defense strategy", async () => {
    defenseStrategy = "open-d6.defenses.active";
    await expect(
      enterSecondEditionCombatantFullDefense(actor, 0),
    ).rejects.toThrow("D6E2.Combat.Error.SecondEditionDefensesInactive");
  });

  it("records D6MV Full Defense as resistance bonuses without changing SRP", async () => {
    defenseStrategy = "d6mv.defenses.srp";
    await enterSecondEditionCombatantFullDefense(actor, 0);
    expect(readCombatantRound(actor)?.secondEditionFullDefense).toMatchObject({
      dodge: 9,
      mentalResistanceBonus: 15,
      parry: 9,
      physicalResistanceBonus: 15,
      sourcePage: 62,
    });
  });

  it("rejects First Edition commitments while that strategy is inactive", async () => {
    await expect(
      commitFirstEditionCombatantActions(actor, {
        actionAllotment: 1,
        defense: "none",
        expectedRevision: 0,
        plannedActionCount: 1,
        spentActionCount: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.FirstEditionActionEconomyInactive");
  });

  it("rejects Second Edition declarations while the flexible strategy is active", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    await expect(
      declareCombatantActions(actor, {
        actions: [{ kind: "other", label: "Wait" }],
        expectedRevision: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.SecondEditionActionEconomyInactive");
  });

  it("routes the neutral complete command through a flexible commitment", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    await commitFirstEditionCombatantActions(actor, {
      actionAllotment: 2,
      defense: "none",
      expectedRevision: 0,
      plannedActionCount: 3,
      spentActionCount: 0,
    });
    expect(readCombatantRound(actor)).toMatchObject({
      actionPenaltyScore: 3,
      penaltyLabel: "−1D",
      penaltyScore: 3,
    });
    await completeNextCombatantAction(actor, 1);
    expect(readCombatantRound(actor)).toMatchObject({
      firstEditionCommitment: { spentActionCount: 1 },
      firstEditionRemainingActionCount: 2,
      revision: 2,
    });
  });
});

describe("GM grid annotations on the existing next slot", () => {
  it("holds and clears without spending, then cancels once with unchanged count and MAP", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    segmentedScheduling = true;
    await commitFirstEditionCombatantActions(actor, {
      actions: [
        { kind: "other", label: "Move and shoot" },
        { kind: "other", label: "Reload" },
      ],
      plannedActionCount: 2,
      actionAllotment: 1,
      defense: "none",
      spentActionCount: 0,
      expectedRevision: 0,
    });
    const initial = readCombatantRound(actor);
    const firstId = initial?.actions[0]?.id;
    if (!initial || !firstId) throw new Error("Missing declaration");
    await expect(
      annotateCombatantNextAction(actor, initial.revision, firstId, "hold"),
    ).rejects.toThrow("notAuthorized");
    vi.stubGlobal("game", { ...game, user: { isGM: true } });
    const held = await annotateCombatantNextAction(
      actor,
      initial.revision,
      firstId,
      "hold",
    );
    expect(held.state?.actionAnnotations?.heldActionId).toBe(firstId);
    expect(held.state?.firstEditionCommitment?.spentActionCount).toBe(0);
    if (!held.state) throw new Error("Missing held state");
    const clear = await annotateCombatantNextAction(
      actor,
      held.state.revision,
      firstId,
      "clear-hold",
    );
    expect(clear.state?.actionAnnotations?.heldActionId).toBeUndefined();
    if (!clear.state) throw new Error("Missing clear state");
    const canceled = await annotateCombatantNextAction(
      actor,
      clear.state.revision,
      firstId,
      "cancel",
    );
    expect(canceled.state?.firstEditionCommitment).toEqual({
      ...initial.firstEditionCommitment,
      spentActionCount: 1,
    });
    expect(canceled.state?.actionAnnotations?.outcomes[firstId]?.status).toBe(
      "canceled",
    );
    await expect(
      annotateCombatantNextAction(
        actor,
        clear.state.revision,
        firstId,
        "cancel",
      ),
    ).rejects.toThrow();
    if (!canceled.state) throw new Error("Missing canceled state");
    await expect(
      annotateCombatantNextAction(
        actor,
        canceled.state.revision,
        firstId,
        "cancel",
      ),
    ).rejects.toThrow("staleState");
    expect(
      readCombatantRound(actor)?.firstEditionCommitment?.spentActionCount,
    ).toBe(1);
  });
});

describe("exact Combatant targeting for duplicated linked Actors", () => {
  it("keeps equal-revision rows distinct and rejects ambiguous actor-only mutations", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    segmentedScheduling = true;
    const secondFlags = new Map<string, unknown>();
    const secondUpdates: Record<string, unknown>[] = [];
    const second = {
      ...combatant,
      id: "combatant-2",
      actor,
      getFlag: (_scope: string, key: string) => secondFlags.get(key),
      update: (changes: Record<string, unknown>) => {
        secondUpdates.push(changes);
        secondFlags.set(
          "roundAction",
          changes["flags.d6-system-2e.roundAction"],
        );
        return Promise.resolve();
      },
    };
    vi.stubGlobal("game", {
      ...game,
      user: { id: "gm", isGM: true },
      combat: {
        id: "combat",
        round: 2,
        combatants: { contents: [combatant, second] },
        turns: [combatant, second],
      },
    });
    const declaration = {
      actions: [
        { kind: "other" as const, label: "One" },
        { kind: "other" as const, label: "Two" },
      ],
      plannedActionCount: 2,
      actionAllotment: 1,
      defense: "none" as const,
      spentActionCount: 0,
      expectedRevision: 0,
    };
    await commitFirstEditionCombatantActions(
      actor,
      declaration,
      undefined,
      combatant.id,
    );
    await commitFirstEditionCombatantActions(
      actor,
      declaration,
      undefined,
      second.id,
    );
    expect(combatant.actor).toBe(second.actor);
    expect(readCombatantRound(actor)).toBeNull();
    expect(readCombatantRound(actor, combatant.id)?.revision).toBe(1);
    expect(readCombatantRound(actor, second.id)?.revision).toBe(1);
    const originalA = structuredClone(flags.get("roundAction"));
    const originalB = structuredClone(secondFlags.get("roundAction"));
    await expect(spendFirstEditionCombatantAction(actor, 1)).rejects.toThrow(
      "ambiguousActor",
    );
    await expect(
      commitFirstEditionCombatantActions(actor, {
        ...declaration,
        expectedRevision: 1,
      }),
    ).rejects.toThrow("ambiguousActor");
    // B must not spend A even though their revisions and linked Actor are equal.
    await expect(
      spendFirstEditionCombatantAction(actor, 1, undefined, second.id),
    ).rejects.toThrow("FirstEditionSegmentTurn");
    expect(flags.get("roundAction")).toEqual(originalA);
    expect(secondFlags.get("roundAction")).toEqual(originalB);
    vi.stubGlobal("game", {
      ...game,
      combat: {
        id: "combat",
        round: 2,
        combatants: { contents: [combatant, second] },
        turns: [second, combatant],
      },
    });
    const b = readCombatantRound(actor, second.id);
    const id = b?.actions[0]?.id;
    if (!b || !id) throw new Error("Missing second queue");
    const held = await annotateCombatantNextAction(
      actor,
      b.revision,
      id,
      "hold",
      undefined,
      second.id,
    );
    if (!held.state) throw new Error("Missing held state");
    expect(readCombatantRound(actor, combatant.id)?.revision).toBe(1);
    const canceled = await executePrivateCombatCommand(
      {
        kind: "cancel",
        actorId: actor.id,
        combatantId: second.id,
        revision: held.state.revision,
        data: { actionId: id },
      },
      { id: "gm", isGM: true } as FoundryUser,
    );
    expect(canceled.state?.firstEditionCommitment?.spentActionCount).toBe(1);
    expect(flags.get("roundAction")).toEqual(originalA);
    await spendFirstEditionCombatantAction(actor, 1, undefined, combatant.id);
    const beforeBSpend = structuredClone(flags.get("roundAction"));
    const nextB = readCombatantRound(actor, second.id);
    if (!nextB) throw new Error("Missing second queue");
    await executePrivateCombatCommand(
      {
        kind: "spend",
        actorId: actor.id,
        combatantId: second.id,
        revision: nextB.revision,
      },
      { id: "gm", isGM: true } as FoundryUser,
    );
    expect(
      readCombatantRound(actor, second.id)?.firstEditionCommitment
        ?.spentActionCount,
    ).toBe(2);
    expect(flags.get("roundAction")).toEqual(beforeBSpend);
    expect(secondUpdates).toHaveLength(4);
  });
});

it("co-writes the segment state and receipt through one confidential persistence call without an ordinary spend", async () => {
  actionEconomyStrategy = "open-d6-flexible-action-allotment";
  segmentedScheduling = true;
  movementStrategy = "open-d6.movement.segmented";
  const state = commitFirstEditionActions(
    createCombatantRoundState(2),
    3,
    1,
    "none",
    0,
    [
      { id: "run", kind: "move", label: "Run", effectiveScore: 9 },
      { id: "later", kind: "skill", label: "Later", effectiveScore: 12 },
      { id: "last", kind: "skill", label: "Last", effectiveScore: 12 },
    ],
  );
  flags.set("roundAction", state);
  const authority = vi
    .spyOn(destinyCrypto, "destinyClientIsAuthority")
    .mockReturnValue(true);
  const routing = vi
    .spyOn(privateCombat, "routePrivateCombatCommand")
    .mockResolvedValue(null);
  const persist = vi
    .spyOn(privateCombat, "persistConfidentialRound")
    .mockResolvedValue(true);
  const receipt = { key: "root:spend:effect", value: { durable: "segment" } };
  try {
    await expect(
      recordFirstEditionCombatantSegmentMovement(
        actor,
        state.revision,
        {
          distance: 6,
          normalDistance: 3,
          consumeAction: true,
          complication: true,
        },
        undefined,
        combatant.id,
        receipt,
      ),
    ).rejects.toThrow("NotAuthorized");
    expect(persist).not.toHaveBeenCalled();
    await recordFirstEditionCombatantSegmentMovement(
      actor,
      state.revision,
      {
        distance: 6,
        normalDistance: 3,
        consumeAction: true,
        complication: true,
      },
      privateCombat.PRIVATE_COMBAT_AUTHORITY,
      combatant.id,
      receipt,
    );
    expect(persist).toHaveBeenCalledTimes(1);
    const saved = persist.mock.calls[0];
    expect(saved?.[0]).toBe(combatant);
    expect(saved?.[1]).toMatchObject({
      revision: state.revision + 2,
      firstEditionCommitment: { spentActionCount: 3 },
      firstEditionSegmentMovement: { remainingMovementDistance: 3 },
      actionAnnotations: {
        outcomes: {
          later: { status: "prevented", reason: "running-complication" },
        },
      },
    });
    expect(saved?.[2]).toEqual(receipt);
    expect(updates).toHaveLength(0);
  } finally {
    authority.mockRestore();
    routing.mockRestore();
    persist.mockRestore();
  }
});
