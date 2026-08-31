import { beforeEach, describe, expect, it, vi } from "vitest";

let defenseTargeting: "actor-static" | "fixed-range" | "manual" = "manual";
let defenseFamilyOverride: "srp" | null = null;
let attackScaleBonus = 0;
let damageScaleBonus = 0;
const combatRounds = new Map<string, object>();

vi.mock("../../settings/defenses", () => ({
  currentDefenseRuntimeStrategy: () => ({
    family:
      defenseFamilyOverride ??
      (defenseTargeting === "manual"
        ? "active"
        : defenseTargeting === "fixed-range"
          ? "range"
          : "static"),
    id:
      defenseTargeting === "manual"
        ? "open-d6.defenses.active"
        : defenseTargeting === "fixed-range"
          ? "d6e2.defenses.no-dodge"
          : "d6e2.defenses.static",
    targeting: defenseTargeting,
  }),
}));

vi.mock("../../settings/scale", () => ({
  currentScaleRuntimeStrategy: () => ({
    family: "ranked",
    id: "d6e2.scale.ranked",
    interaction: () => ({
      attackerAttackBonusScore: attackScaleBonus,
      attackerDamageBonusScore: damageScaleBonus,
      difference: 0,
      targetDodgeBonus: 0,
      targetResistanceBonusScore: 0,
    }),
    sourcePage: 196,
  }),
  scaleRuntimeStrategy: () => ({
    family: "ranked",
    id: "d6e2.scale.ranked",
    interaction: () => ({
      attackerAttackBonusScore: attackScaleBonus,
      attackerDamageBonusScore: damageScaleBonus,
      difference: 0,
      targetDodgeBonus: 0,
      targetResistanceBonusScore: 0,
    }),
    sourcePage: 196,
  }),
}));

vi.mock("../../settings/attributes", () => ({
  currentAttributeRole: () => "brawn",
  currentAttributeRuntimeStrategy: () => ({ family: "second-edition" }),
}));

vi.mock("../../settings/campaign-profile", () => ({
  currentSecondEditionCampaignProfile: () => ({
    activeResponsiveCombat: false,
    scienceFictionSkills: false,
  }),
}));

vi.mock("../../settings/pip-rules", () => ({
  currentCombinedPipScore: (...scores: number[]) =>
    scores.reduce((total, score) => total + score, 0),
  currentEffectivePipScore: (score: number) => score,
}));

vi.mock("../../settings/setting-values", () => ({
  booleanSetting: () => false,
  currentActionDeclarationAssistance: () => "manual",
  currentDefaultRollMode: () => "publicroll",
  numberSetting: (_key: string, fallback: number) => fallback,
  stringSetting: (_key: string, fallback: string) => fallback,
}));

vi.mock("../combat-service", () => ({
  clearSecondEditionCombatantFeint: vi.fn(),
  readCombatantRound: (actor: { readonly id?: string }) =>
    combatRounds.get(actor.id ?? "") ?? null,
}));

import {
  buildWeaponAttackTargetContext,
  ordinaryWeaponAttackRollMode,
  synchronizeCombatRollTarget,
  weaponAttackDifficultySelection,
  weaponTargetDifficultyControlState,
  weaponTargetDifficultyPreview,
} from "./roll-service";

const setTargets = vi.fn();

const sourceToken = {
  actor: {
    id: "source-actor",
    img: "source.webp",
    name: "Source Actor",
    type: "character",
  },
  center: { x: 0, y: 0 },
  controlled: true,
  id: "source-token",
};
const targetToken = {
  actor: {
    id: "target-actor",
    img: "target.webp",
    items: { contents: [] },
    name: "Target Actor",
    system: {
      attributes: {
        agility: { score: 9 },
        charm: { score: 12 },
        perception: { score: 9 },
      },
      defenses: {},
      movement: { posture: "standing" },
      scale: 0,
    },
    type: "npc",
  },
  center: { x: 8, y: 0 },
  document: { texture: { src: "target-token.webp" } },
  id: "target-token",
  isPreview: false,
  name: "Visible Target",
  visible: true,
};
const secondTargetToken = {
  ...targetToken,
  actor: {
    ...targetToken.actor,
    id: "second-target-actor",
    name: "Second Target Actor",
  },
  center: { x: 18, y: 0 },
  id: "second-target-token",
  name: "Alternate Target",
};
const actor = {
  getActiveTokens: () => [sourceToken],
  id: "source-actor",
  items: { contents: [] },
  name: "Source Actor",
  system: {
    attributes: {
      agility: { score: 9 },
      brawn: { score: 9 },
      perception: { score: 9 },
    },
    scale: 0,
  },
  type: "character",
};
const weapon = {
  id: "weapon",
  system: {
    range: { long: 30, medium: 20, short: 10, shortMinimum: 0 },
    scale: 0,
    weaponKind: "standard",
  },
  type: "weapon",
};

describe("weapon roll target context", () => {
  beforeEach(() => {
    defenseTargeting = "manual";
    defenseFamilyOverride = null;
    attackScaleBonus = 0;
    damageScaleBonus = 0;
    combatRounds.clear();
    setTargets.mockReset();
    vi.stubGlobal("game", {
      combat: null,
      i18n: { localize: (key: string) => key },
      user: { targets: new Set([targetToken]) },
    });
    vi.stubGlobal("canvas", {
      grid: {
        measurePath: (points: readonly { x: number }[]) => ({
          distance: points.at(-1)?.x ?? 0,
        }),
      },
      scene: { grid: { distance: 1 } },
      tokens: { placeables: [sourceToken, targetToken], setTargets },
    });
  });

  it("captures the target's distinct attack and Damage scale contexts", () => {
    attackScaleBonus = 3;
    damageScaleBonus = 6;
    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
    );

    expect(context.selectedTarget?.scale).toMatchObject({
      application: "attack",
      modifierScore: 3,
    });
    expect(context.selectedTarget?.damageScale).toMatchObject({
      application: "damage",
      modifierScore: 6,
      sourceActorId: "source-actor",
      targetActorId: "target-actor",
    });
  });

  it("binds a preferred reaction target by Actor when its original token id is unavailable", () => {
    vi.stubGlobal("game", {
      combat: null,
      i18n: { localize: (key: string) => key },
      user: { targets: new Set() },
    });
    vi.stubGlobal("canvas", {
      grid: {
        measurePath: (points: readonly { x: number }[]) => ({
          distance: points.at(-1)?.x ?? 0,
        }),
      },
      scene: { grid: { distance: 1 } },
      tokens: {
        placeables: [sourceToken, targetToken, secondTargetToken],
        setTargets,
      },
    });

    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
      "attack",
      { targetActorId: "second-target-actor" },
    );

    expect(context.selectedTarget?.actorId).toBe("second-target-actor");
    expect(context.selectedTarget?.id).toBe("second-target-token");
  });

  it("replaces the Foundry target when a combat roll target changes", () => {
    synchronizeCombatRollTarget("second-target-token");

    expect(setTargets).toHaveBeenCalledOnce();
    expect(setTargets).toHaveBeenCalledWith(["second-target-token"], {
      mode: "replace",
    });
  });

  it("clears the Foundry target when the combat roll target is cleared", () => {
    synchronizeCombatRollTarget("");

    expect(setTargets).toHaveBeenCalledOnce();
    expect(setTargets).toHaveBeenCalledWith([], { mode: "replace" });
  });

  it("derives First Edition Medium 20 m difficulty from measured range", () => {
    const mediumTarget = { ...targetToken, center: { x: 20, y: 0 } };
    vi.stubGlobal("game", {
      ...game,
      user: { targets: new Set([mediumTarget]) },
    });
    vi.stubGlobal("canvas", {
      ...canvas,
      tokens: { placeables: [sourceToken, mediumTarget] },
    });
    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
    );

    expect(context.hasTargets).toBe(true);
    expect(context.selectedTarget).toMatchObject({
      defense: 15,
      defenseKind: "range",
      defenseStrategy: "first-edition-range",
      distance: 20,
      id: "target-token",
      name: "Visible Target",
      rangeBand: "medium",
      selected: true,
    });
    expect(context.selectedTarget?.optionLabel).toBe(
      "Visible Target · TYPES.Actor.npc · D6E2.Combat.Range.Medium · 20 D6E2.Combat.Meters",
    );
    expect(context.hasAuthoritativeTargetDifficulty).toBe(true);
    expect(context.showCoverModifier).toBe(false);
    expect(context.targets).toHaveLength(1);
  });

  it("applies a completed First Edition Dodge before the Medium modifier", () => {
    const mediumTarget = { ...targetToken, center: { x: 20, y: 0 } };
    combatRounds.set("target-actor", {
      firstEditionActiveDefense: {
        difficulty: 18,
        kind: "dodge",
        label: "Dodge",
        mode: "partial",
        sourceId: "dodge",
        total: 18,
      },
    });
    vi.stubGlobal("game", {
      ...game,
      user: { targets: new Set([mediumTarget]) },
    });
    vi.stubGlobal("canvas", {
      ...canvas,
      tokens: { placeables: [sourceToken, mediumTarget] },
    });

    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
    );

    expect(context.selectedTarget).toMatchObject({
      defense: 23,
      defenseKind: "dodge",
      defenseStrategy: "first-edition-active-defense",
      rangeBand: "medium",
    });
  });

  it("uses the First Edition three-meter Point Blank boundary", () => {
    const pointBlankTarget = { ...targetToken, center: { x: 3, y: 0 } };
    vi.stubGlobal("game", {
      ...game,
      user: { targets: new Set([pointBlankTarget]) },
    });
    vi.stubGlobal("canvas", {
      ...canvas,
      tokens: { placeables: [sourceToken, pointBlankTarget] },
    });

    expect(
      buildWeaponAttackTargetContext(actor as never, weapon as never)
        .selectedTarget,
    ).toMatchObject({
      defense: 5,
      defenseStrategy: "first-edition-range",
      rangeBand: "point-blank",
    });
  });

  it("uses calculated target difficulty until a valid custom integer overrides it", () => {
    vi.stubGlobal("canvas", {
      ...canvas,
      tokens: {
        placeables: [sourceToken, targetToken, secondTargetToken],
      },
    });
    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
    );
    const byId = new Map(context.targets.map((target) => [target.id, target]));
    const selected = weaponTargetDifficultyControlState({
      currentValue: "17",
      targetDifficulty: byId.get("second-target-token")?.defense,
      wasTargetControlled: false,
    });
    const switched = weaponTargetDifficultyControlState({
      currentValue: selected.value,
      manualDifficulty: selected.manualDifficulty,
      targetDifficulty: byId.get("target-token")?.defense,
      wasTargetControlled: selected.targetControlled,
    });
    const cleared = weaponTargetDifficultyControlState({
      currentValue: switched.value,
      manualDifficulty: switched.manualDifficulty,
      wasTargetControlled: switched.targetControlled,
    });

    expect(selected).toMatchObject({
      difficultySource: "calculated",
      manualDifficulty: "17",
      readOnly: false,
      targetControlled: true,
      value: "15",
    });
    const custom = weaponTargetDifficultyControlState({
      currentValue: "12",
      difficultySource: "custom",
      manualDifficulty: selected.manualDifficulty,
      targetDifficulty: byId.get("second-target-token")?.defense,
      wasTargetControlled: selected.targetControlled,
    });
    expect(custom).toMatchObject({
      difficultySource: "custom",
      readOnly: false,
      targetControlled: true,
      value: "12",
    });
    expect(switched).toMatchObject({
      difficultySource: "calculated",
      manualDifficulty: "17",
      readOnly: false,
      targetControlled: true,
      value: "10",
    });
    expect(cleared).toMatchObject({
      readOnly: false,
      targetControlled: false,
      value: "17",
    });
  });

  it("falls back to calculated difficulty when custom is empty or invalid and accepts zero", () => {
    expect(
      weaponAttackDifficultySelection({
        customSelected: false,
        targetDifficulty: 15,
      }),
    ).toEqual({ calculatedValue: 15, source: "calculated", value: 15 });
    expect(
      weaponAttackDifficultySelection({
        customDifficulty: undefined,
        customSelected: true,
        targetDifficulty: 15,
      }),
    ).toEqual({ calculatedValue: 15, source: "calculated", value: 15 });
    expect(
      weaponAttackDifficultySelection({
        customDifficulty: 0,
        customSelected: true,
        targetDifficulty: 15,
      }),
    ).toEqual({ calculatedValue: 15, source: "custom", value: 0 });
    expect(
      weaponAttackDifficultySelection({
        customDifficulty: 12,
        customSelected: true,
        targetDifficulty: 15,
      }),
    ).toEqual({ calculatedValue: 15, source: "custom", value: 12 });
  });

  it("uses a targeted visible token and excludes targets the user cannot see", () => {
    defenseTargeting = "actor-static";
    const hiddenTarget = {
      ...secondTargetToken,
      id: "hidden-target-token",
      visible: false,
    };
    vi.stubGlobal("canvas", {
      ...canvas,
      tokens: {
        placeables: [sourceToken, hiddenTarget, targetToken],
      },
    });

    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
    );

    expect(context.hasAuthoritativeTargetDifficulty).toBe(true);
    expect(context.selectedTarget).toMatchObject({
      defenseKind: "dodge",
      defenseStrategy: "static-dodge",
      id: "target-token",
      selected: true,
    });
    expect(context.targets.map(({ id }) => id)).toEqual(["target-token"]);
  });

  it("carries an authoritative hidden TokenDocument state and narrows its root audience", () => {
    defenseTargeting = "actor-static";
    const hiddenDocumentTarget = {
      ...targetToken,
      document: { hidden: true, texture: { src: "target-token.webp" } },
      visible: true,
    };
    vi.stubGlobal("game", {
      ...game,
      user: { isGM: true, targets: new Set([hiddenDocumentTarget]) },
    });
    vi.stubGlobal("canvas", {
      ...canvas,
      tokens: { placeables: [sourceToken, hiddenDocumentTarget] },
    });

    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
    );

    expect(context.selectedTarget).toMatchObject({
      hidden: true,
      id: "target-token",
    });
    expect(ordinaryWeaponAttackRollMode("publicroll", true)).toBe("gmroll");
    expect(ordinaryWeaponAttackRollMode("selfroll", true)).toBe("gmroll");
    expect(ordinaryWeaponAttackRollMode("blindroll", true)).toBe("blindroll");
    expect(ordinaryWeaponAttackRollMode("publicroll", false)).toBe(
      "publicroll",
    );
  });

  it("derives each No Dodge difficulty from the selected target's measured range", () => {
    defenseTargeting = "fixed-range";
    vi.stubGlobal("canvas", {
      ...canvas,
      tokens: {
        placeables: [sourceToken, targetToken, secondTargetToken],
      },
    });

    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
    );
    const byId = new Map(context.targets.map((target) => [target.id, target]));

    expect(byId.get("target-token")).toMatchObject({
      defense: 10,
      rangeBand: "short",
    });
    expect(byId.get("second-target-token")).toMatchObject({
      defense: 15,
      rangeBand: "medium",
    });
    expect(
      weaponTargetDifficultyPreview({
        defense: byId.get("target-token")?.defense,
        defenseStrategy: byId.get("target-token")?.defenseStrategy,
        rangeBand: byId.get("target-token")?.rangeBand,
      }),
    ).toBe(10);
    expect(
      weaponTargetDifficultyPreview({
        defense: byId.get("second-target-token")?.defense,
        defenseStrategy: byId.get("second-target-token")?.defenseStrategy,
        rangeBand: byId.get("second-target-token")?.rangeBand,
      }),
    ).toBe(15);
  });

  it.each([
    ["point-blank", false, 5],
    ["short", false, 10],
    ["medium", false, 15],
    ["long", false, 20],
    ["long", true, 30],
  ] as const)(
    "keeps the %s range-band difficulty authoritative when dodging is %s",
    (rangeBand, targetDodging, difficulty) => {
      expect(
        weaponTargetDifficultyPreview({
          defense: 0,
          defenseStrategy: "fixed-range",
          rangeBand,
          targetDodging,
        }),
      ).toBe(difficulty);
    },
  );

  it("marks a First Edition measured target beyond Long as out of range before dice", () => {
    const distantTarget = {
      ...targetToken,
      center: { x: 31, y: 0 },
    };
    vi.stubGlobal("game", {
      ...game,
      user: { targets: new Set([distantTarget]) },
    });
    vi.stubGlobal("canvas", {
      ...canvas,
      tokens: { placeables: [sourceToken, distantTarget] },
    });

    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
    );

    expect(context.selectedTarget).toMatchObject({
      outOfRange: true,
      rangeLabel: "D6E2.Combat.Range.OutOfRange",
    });
    expect(context.selectedTarget).not.toHaveProperty("defense");
    expect(
      weaponTargetDifficultyPreview({
        defense: context.selectedTarget?.defense,
        defenseStrategy: context.selectedTarget?.defenseStrategy,
        outOfRange: true,
        rangeBand: context.selectedTarget?.rangeBand,
      }),
    ).toBeUndefined();
  });

  it("keeps the target list without selecting one when the user has no target", () => {
    defenseTargeting = "actor-static";
    vi.stubGlobal("game", {
      ...game,
      user: { targets: new Set() },
    });

    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
    );

    expect(context.hasTargets).toBe(true);
    expect(context.selectedTarget).toBeNull();
    expect(context.targets).toHaveLength(1);
  });

  it("exposes all D6MV SRP defenses without replacing the selected readiness", () => {
    defenseTargeting = "actor-static";
    defenseFamilyOverride = "srp";

    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
    );

    expect(context.showSrpMode).toBe(true);
    expect(context.selectedTarget).toMatchObject({
      defense: 19,
      defenseStrategy: "d6mv-srp",
      srp: { psyche: 22, ready: 19, surprised: 19 },
    });
  });

  it("exposes source-defined Static and Mobile VSM defenses for a D6MV vehicle target", () => {
    defenseTargeting = "actor-static";
    defenseFamilyOverride = "srp";
    const vehicleTarget = {
      ...targetToken,
      actor: {
        ...targetToken.actor,
        system: {
          attributes: {
            hull: { score: 8 },
            maneuverability: { score: 17 },
          },
          scale: 1,
        },
        type: "vehicle",
      },
    };
    vi.stubGlobal("game", {
      ...game,
      user: { targets: new Set([vehicleTarget]) },
    });
    vi.stubGlobal("canvas", {
      ...canvas,
      tokens: { placeables: [sourceToken, vehicleTarget] },
    });

    const context = buildWeaponAttackTargetContext(
      actor as never,
      weapon as never,
    );

    expect(context.showVsmMode).toBe(true);
    expect(context.selectedTarget).toMatchObject({
      defense: 11,
      defenseSourcePage: 98,
      defenseStrategy: "d6mv-vsm",
      vsm: { mobile: 16, static: 11 },
    });
  });
});
