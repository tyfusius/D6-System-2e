import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  D6_HEALTH_MODEL_CONTRACT_VERSION,
  defaultHealthDamageResults,
  generateMonotonicDamageTransitions,
} from "@d6-system-2e/core";

const values = new Map<string, unknown>();
const writes: string[] = [];
const actors: FoundryActorDocument[] = [];
const gameUser = { isGM: true };
vi.stubGlobal("game", {
  actors: { contents: actors },
  i18n: { localize: (key: string) => key },
  settings: {
    get: (_system: string, key: string) => values.get(key),
    set: (_system: string, key: string, value: unknown) => {
      writes.push(key);
      values.set(key, value);
      return Promise.resolve(value);
    },
  },
  user: gameUser,
});
vi.stubGlobal("Hooks", { callAll: vi.fn() });

import {
  availableRulesProfiles,
  availableWorldHealthModels,
  bundledRulesProfiles,
  activateWorldHealthModel,
  currentConfiguredRulesProfile,
  deleteWorldHealthModel,
  deleteWorldHealthModelWithReassignment,
  deleteWorldRulesProfile,
  duplicateRulesProfile,
  duplicateWorldHealthModel,
  ensureWorldRulesProfilesStored,
  evaluateRulesPredicate,
  exportRulesProfile,
  exportWorldHealthModel,
  importRulesProfile,
  importWorldHealthModel,
  normalizeRulesProfile,
  registerRulesProfileContribution,
  resetRulesProfileLibraryForTests,
  rulesProfileDiagnostics,
  rulesProfileSettingsWorkspace,
  saveWorldHealthModel,
  selectRulesProfile,
  saveNewWorldRulesProfile,
  saveWorldRulesProfile,
  storedWorldRulesProfiles,
  worldHealthStateImpacts,
} from "./rules-profile-library";
import {
  availableHealthModels,
  registerHealthModelContribution,
  resetHealthModelLibraryForTests,
} from "./health-model-library";
import {
  D6_NEXUS_MATCHING_DETECTOR_ID,
  matchingDetectorForProfile,
  matchingDetector,
  worldMatchingDetectorId,
} from "../registries/matching-evaluators";

function worldTrack(id: string, label = "Grit") {
  const states = [
    {
      allowsActions: true,
      description: "No current injury limits this character.",
      id: "ready",
      label: "Ready",
      penaltyScore: 0,
      terminal: false,
    },
    {
      allowsActions: false,
      id: "down",
      label: "Down",
      penaltyScore: 6,
      terminal: true,
    },
  ] as const;
  return {
    damageStrategyId: "d6e2.damage.conditions" as const,
    description: "",
    id,
    kind: "track" as const,
    label,
    source: { kind: "world" as const },
    track: {
      damageResults: defaultHealthDamageResults("d6e2.damage.conditions"),
      damageTransitions: generateMonotonicDamageTransitions(states, [
        "staggered",
        "stunned",
        "wounded",
        "mortally-wounded",
        "dead",
      ]),
      initialStateId: "ready",
      ruleProvenance: "authored" as const,
      states,
    },
    version: D6_HEALTH_MODEL_CONTRACT_VERSION,
  };
}

function v2WorldTrack(id: string) {
  const current = worldTrack(id);
  return {
    ...current,
    track: {
      damageTransitions: current.track.damageTransitions,
      initialStateId: current.track.initialStateId,
      states: current.track.states,
    },
    version: 2 as const,
  };
}

function personalWorldRehearsalRulesLibrary() {
  return {
    activeProfileId: "new-rules-profile",
    profiles: {
      "new-rules-profile": {
        constraints: [],
        description:
          "REUP-oriented mechanics composed from the current public D6 System strategy catalog.",
        difficultyLadder: [
          { id: "very-easy", label: "Very Easy", value: 5 },
          { id: "easy", label: "Easy", value: 10 },
          { id: "moderate", label: "Moderate", value: 15 },
          { id: "difficult", label: "Difficult", value: 20 },
          { id: "very-difficult", label: "Very Difficult", value: 30 },
          { id: "heroic", label: "Heroic", value: 35 },
        ],
        healthModels: [],
        homebrew: { tyfusiusD8ExplosiveDeviation: false },
        id: "new-rules-profile",
        label: "Star Wars D6 REUP · Customized",
        source: { kind: "world" },
        strategies: {
          actionEconomy: "open-d6.action-economy.flexible",
          activeDefenses: "open-d6.defenses.active",
          advancement: "open-d6.advancement.character-points",
          attributes: "open-d6.attributes.six-attribute",
          health: "open-d6.health.wound-track",
          initiative: "open-d6.initiative.perception",
          metaCurrency: "open-d6.meta-currency.character-and-fate-points",
          movement: "open-d6.movement.relative",
          pips: "open-d6.pips.classic",
          retries: "open-d6.retries.no-general-reroll",
          scale: "open-d6.scale.scalar",
          successEvaluator: "open-d6.success.meets-or-exceeds",
          wildDie: "open-d6.wild-die.critical-one",
        },
        terminology: {
          attributes: {
            agility: "Dexterity",
            brawn: "Strength",
            knowledge: "Knowledge",
            mechanical: "Mechanical",
            perception: "Perception",
            technical: "Technical",
          },
          characterSheetLabel: "Star Wars D6 Character",
          details: { allegiance: "Allegiance", currency: "Credits" },
          machines: {
            interstellarDrive: "Hyperdrive",
            starshipToughness: "Hull",
            vehicleToughness: "Body Strength",
          },
          manifestations: {
            plural: "Force Powers",
            singular: "Force Power",
          },
          metaphysics: {
            attribute: "The Force",
            extranormal: "The Force",
            skills: {
              channel: "Control",
              sense: "Sense",
              transform: "Alter",
            },
          },
          resources: {
            characterPoints: "Character Points",
            experiencePoints: "Character Points",
            fatePoints: "Force Points",
          },
          systemLabel: "Star Wars D6",
        },
        version: 3,
      },
    },
    version: 3,
  };
}

describe("versioned Rules Profile library", () => {
  beforeEach(() => {
    values.clear();
    writes.length = 0;
    resetRulesProfileLibraryForTests();
    resetHealthModelLibraryForTests();
    actors.length = 0;
    gameUser.isGM = true;
  });

  it("activates the complete bundled FreeD6 strategy composition without unavailable diagnostics", () => {
    const profile = bundledRulesProfiles().find(({ id }) => id === "free-d6");
    expect(profile?.strategies).toMatchObject({
      consequenceSuite: "free-d6.consequences.physical-and-fatigue",
      creation: "free-d6.creation.creation-points",
      featureEconomy: "free-d6.features.merits-flaws",
    });
    expect(profile && rulesProfileDiagnostics(profile)).toEqual([]);
  });

  it("upgrades the profile contract once and preserves normalized repeats", async () => {
    values.set("worldRulesProfiles", {
      activeProfileId: "table-rules",
      profiles: {
        "table-rules": {
          ...normalizeRulesProfile({ id: "table-rules", label: "Table" }),
          difficultyLadder: undefined,
          version: 1,
        },
      },
      version: 1,
    });
    const first = await ensureWorldRulesProfilesStored();
    expect(first.version).toBe(4);
    expect(first.profiles["table-rules"]?.healthModels).toEqual([]);
    expect(first.profiles["table-rules"]?.difficultyLadder).toHaveLength(6);
    expect(writes).toEqual(["worldRulesProfiles"]);
    await ensureWorldRulesProfilesStored();
    expect(writes).toEqual(["worldRulesProfiles"]);
  });

  it("upgrades embedded v2 health metadata without changing its matrix", async () => {
    const legacy = v2WorldTrack("table-rules.health.legacy");
    const profile = normalizeRulesProfile({
      healthModels: [],
      id: "table-rules",
      label: "Table",
    });
    values.set("worldRulesProfiles", {
      activeProfileId: profile.id,
      profiles: {
        [profile.id]: {
          ...profile,
          healthModels: [legacy],
          strategies: { ...profile.strategies, health: legacy.id },
        },
      },
      version: 3,
    });

    const stored = await ensureWorldRulesProfilesStored();
    const upgraded = stored.profiles[profile.id]?.healthModels[0];
    expect(upgraded?.version).toBe(3);
    expect(
      upgraded?.kind === "track" && upgraded.track.damageTransitions,
    ).toEqual(legacy.track.damageTransitions);
    expect(writes).toEqual(["worldRulesProfiles"]);
  });

  it("loads the exact Personal World Rehearsal rules envelope without rewriting it", async () => {
    const rehearsal = personalWorldRehearsalRulesLibrary();
    values.set("worldRulesProfiles", structuredClone(rehearsal));

    const stored = await ensureWorldRulesProfilesStored();
    expect(stored).toMatchObject({
      activeProfileId: rehearsal.activeProfileId,
      version: 4,
    });
    expect(stored.profiles["new-rules-profile"]).toMatchObject({
      id: "new-rules-profile",
      matchingEvaluators: [],
      version: 4,
    });
    expect(currentConfiguredRulesProfile().strategies).not.toHaveProperty(
      "rollResolution",
    );
    expect(currentConfiguredRulesProfile().strategies.health).toBe(
      "open-d6.health.wound-track",
    );
    expect(currentConfiguredRulesProfile().healthModels).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("keeps the empty D62E clean-room world on untouched bundled defaults", async () => {
    values.set("worldRulesProfiles", {
      activeProfileId: "second-edition",
      profiles: {},
      version: 3,
    });

    const stored = await ensureWorldRulesProfilesStored();
    expect(stored).toEqual({
      activeProfileId: "second-edition",
      profiles: {},
      version: 4,
    });
    expect(currentConfiguredRulesProfile().id).toBe("second-edition");
    expect(currentConfiguredRulesProfile().healthModels).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("migrates the legacy Game Mode selection once into the active profile", async () => {
    values.set("gameMode", "open-d6");
    const world = await ensureWorldRulesProfilesStored();
    expect(world.activeProfileId).toBe("open-d6");
    expect(world.profiles).toEqual({});
    expect(currentConfiguredRulesProfile().source.kind).toBe("bundled");
    expect(currentConfiguredRulesProfile().strategies.scale).toBe(
      "open-d6.scale.scalar",
    );
    expect(currentConfiguredRulesProfile().difficultyLadder).toEqual([
      { id: "very-easy", label: "Very Easy", value: 5 },
      { id: "easy", label: "Easy", value: 10 },
      { id: "moderate", label: "Moderate", value: 15 },
      { id: "difficult", label: "Difficult", value: 20 },
      { id: "very-difficult", label: "Very Difficult", value: 30 },
      { id: "heroic", label: "Heroic", value: 35 },
    ]);
  });

  it("migrates a mixed legacy selection into one world-owned strategy profile", async () => {
    values.set("useFirstEditionMovement", true);
    const world = await ensureWorldRulesProfilesStored();
    expect(world.activeProfileId).toBe("migrated-rules-profile");
    expect(world.profiles["migrated-rules-profile"]?.strategies.movement).toBe(
      "open-d6.movement.relative",
    );
    expect(
      world.profiles["migrated-rules-profile"]?.strategies.attributes,
    ).toBe("d6e2.attributes.campaign-profile");
  });

  it("resolves one detailed settings workspace for the active profile", () => {
    const profiles = availableRulesProfiles();
    const secondEdition = profiles.find(({ id }) => id === "second-edition");
    const openD6 = profiles.find(({ id }) => id === "open-d6");
    expect(secondEdition).toBeDefined();
    expect(openD6).toBeDefined();
    expect(
      rulesProfileSettingsWorkspace(secondEdition ?? normalizeRulesProfile({})),
    ).toBe("second-edition");
    expect(
      rulesProfileSettingsWorkspace(openD6 ?? normalizeRulesProfile({})),
    ).toBe("open-d6");

    const mixed = normalizeRulesProfile({
      id: "mixed-rules",
      strategies: { wildDie: "open-d6.wild-die.critical-one" },
    });
    expect(rulesProfileSettingsWorkspace(mixed)).toBe("second-edition");
  });

  it("recognizes every concrete Open D6 health model directly", () => {
    for (const health of [
      "open-d6.health.wound-track",
      "open-d6.health.body-points",
      "open-d6.health.body-points-with-wounds",
    ]) {
      const profile = normalizeRulesProfile({
        id: `table-${health.split(".").at(-1)}`,
        strategies: { health },
      });
      expect(profile.strategies.health).toBe(health);
    }
  });

  it("activates a profile without rewriting retired compatibility settings", async () => {
    values.set("worldRulesProfiles", {
      activeProfileId: "second-edition",
      profiles: {},
      version: 1,
    });
    await selectRulesProfile("open-d6");
    expect(
      (values.get("worldRulesProfiles") as { activeProfileId: string })
        .activeProfileId,
    ).toBe("open-d6");
    expect(values.has("gameMode")).toBe(false);
    expect(values.has("useOpenD6Rules")).toBe(false);
  });

  it("keeps module provenance and world profiles separate", async () => {
    registerRulesProfileContribution("echo-d6", {
      id: "echo-rules",
      label: "Echo D6",
    });
    expect(
      availableRulesProfiles().find(({ id }) => id === "echo-rules")?.source,
    ).toEqual({ kind: "module", ownerId: "echo-d6" });

    const saved = await saveWorldRulesProfile({
      id: "table-rules",
      label: "Table Rules",
    });
    expect(saved.source.kind).toBe("world");
    expect(values.get("worldRulesProfiles")).toEqual(
      expect.objectContaining({ activeProfileId: "second-edition" }),
    );
  });

  it("creates a world profile with a chosen stable id without overwriting another profile", async () => {
    const saved = await saveNewWorldRulesProfile({
      id: "table-rules",
      label: "Table Rules",
    });
    expect(saved.id).toBe("table-rules");
    await expect(
      saveNewWorldRulesProfile({ id: "table-rules", label: "Replacement" }),
    ).rejects.toThrow("already exists");
    await expect(
      saveNewWorldRulesProfile({ id: "Not Valid", label: "Invalid" }),
    ).rejects.toThrow("Invalid Rules Profile ID");
    expect(storedWorldRulesProfiles().profiles["table-rules"]?.label).toBe(
      "Table Rules",
    );
  });

  it("evaluates declarative setting dependencies against strategies and settings", () => {
    const profile = availableRulesProfiles().find(
      ({ id }) => id === "second-edition",
    );
    expect(profile).toBeDefined();
    const requirement = {
      kind: "any" as const,
      predicates: [
        {
          equals: "open-d6.pips.classic",
          kind: "strategy" as const,
          slot: "pips" as const,
        },
        {
          equals: true,
          key: "secondEditionPipsModule",
          kind: "setting" as const,
        },
      ],
    };
    expect(
      evaluateRulesPredicate(
        requirement,
        profile ?? normalizeRulesProfile({}),
        () => false,
      ),
    ).toBe(false);
    expect(
      evaluateRulesPredicate(
        requirement,
        profile ?? normalizeRulesProfile({}),
        (key) => key === "secondEditionPipsModule",
      ),
    ).toBe(true);
  });

  it("duplicates immutable profiles as uniquely identified world-owned copies", async () => {
    const source = Object.freeze({
      ...currentConfiguredRulesProfile(),
      homebrew: Object.freeze({ tyfusiusD8ExplosiveDeviation: true }),
    });
    const first = duplicateRulesProfile(source);
    expect(first.id).toBe("second-edition-copy");
    expect(first.source).toEqual({ kind: "world" });
    expect(first.homebrew.tyfusiusD8ExplosiveDeviation).toBe(true);
    await saveWorldRulesProfile(first);
    expect(duplicateRulesProfile(source).id).toBe("second-edition-copy-2");
  });

  it("round-trips a portable export without overwriting an existing id", async () => {
    const source = await saveWorldRulesProfile({
      ...currentConfiguredRulesProfile(),
      homebrew: { tyfusiusD8ExplosiveDeviation: true },
      id: "table-rules",
      label: "Table Rules",
      source: { kind: "world" },
    });
    const imported = importRulesProfile(exportRulesProfile(source));
    expect(imported.id).toBe("table-rules-2");
    expect(imported.source).toEqual({ kind: "world" });
    expect(imported.strategies).toEqual(source.strategies);
    expect(imported.difficultyLadder).toEqual(source.difficultyLadder);
    expect(imported.homebrew).toEqual({
      tyfusiusD8ExplosiveDeviation: true,
    });
  });

  it("normalizes the additive d8 deviation option off without a contract migration", () => {
    expect(normalizeRulesProfile({ id: "legacy-profile" }).homebrew).toEqual({
      tyfusiusD8ExplosiveDeviation: false,
    });
  });

  it("defaults matching rewards off and preserves a portable composite-keyed policy", () => {
    expect(
      normalizeRulesProfile({ id: "legacy-profile" }).homebrew.matchingRewards,
    ).toBeUndefined();
    const profile = normalizeRulesProfile({
      id: "reward-profile",
      homebrew: {
        tyfusiusD8ExplosiveDeviation: false,
        matchingRewards: [
          {
            awards: {
              "full-house": {
                characterPoints: 2,
                enabled: true,
                metaCurrency: 1,
                patternLabel: "Full house",
                sourceLabel: "D6 Nexus",
              },
            },
            enabled: true,
            evaluatorId: "d6-nexus.matches-v1",
            detectorId: "d6-nexus.matching-detector.matches-v1",
            version: 1,
          },
        ],
      },
    });
    const imported = importRulesProfile(exportRulesProfile(profile));
    expect(imported.homebrew.matchingRewards).toEqual(
      profile.homebrew.matchingRewards,
    );
  });

  it("embeds and round-trips a selected world health model", async () => {
    const model = worldTrack("grit-rules.health.grit");
    const source = await saveWorldRulesProfile({
      id: "grit-rules",
      label: "Grit Rules",
      strategies: { health: "grit-rules.health.grit" },
      healthModels: [model],
    });
    expect(rulesProfileDiagnostics(source)).toEqual([]);
    const imported = importRulesProfile(exportRulesProfile(source));
    expect(imported.healthModels).toHaveLength(1);
    expect(imported.healthModels[0]?.id).toBe("grit-rules.health.grit");
    expect(
      imported.healthModels[0]?.kind === "track" &&
        imported.healthModels[0].track.states[0]?.description,
    ).toBe("No current injury limits this character.");
  });

  it("shares one stable world model identity only when mechanics are identical", async () => {
    const model = worldTrack("grit-rules.health.grit");
    await saveWorldRulesProfile({
      healthModels: [model],
      id: "grit-rules",
      label: "Grit Rules",
      strategies: { health: model.id },
    });
    const shared = await saveWorldRulesProfile({
      healthModels: [model],
      id: "other-rules",
      label: "Other Rules",
      strategies: { health: model.id },
    });
    expect(shared.healthModels[0]?.id).toBe(model.id);

    const divergent = worldTrack(model.id, "Different definition");
    await expect(
      saveWorldRulesProfile({
        healthModels: [divergent],
        id: "third-rules",
        label: "Third Rules",
      }),
    ).rejects.toThrow("different stored definition");
    expect(() =>
      importRulesProfile({
        ...exportRulesProfile({
          ...shared,
          healthModels: [divergent],
          id: "third-rules",
        }),
      }),
    ).toThrow("different stored definition");
  });

  it("lists shared world models once and reports state-removal Actor impact", async () => {
    const model = worldTrack("grit-rules.health.grit");
    await saveWorldRulesProfile({
      healthModels: [model],
      id: "grit-rules",
      label: "Grit Rules",
      strategies: { health: model.id },
    });
    await saveWorldRulesProfile({
      healthModels: [model],
      id: "shared-rules",
      label: "Shared Rules",
      strategies: { health: model.id },
    });
    actors.push(
      {
        name: "Zulu",
        system: { health: { tracks: { [model.id]: { stateId: "down" } } } },
        type: "character",
      } as unknown as FoundryActorDocument,
      {
        name: "Alpha",
        system: { health: { tracks: { [model.id]: { stateId: "down" } } } },
        type: "npc",
      } as unknown as FoundryActorDocument,
    );
    expect(availableWorldHealthModels().map(({ id }) => id)).toEqual([
      model.id,
    ]);
    expect(worldHealthStateImpacts(model.id)).toEqual([
      {
        actorCount: 2,
        actorNames: ["Alpha", "Zulu"],
        stateId: "down",
      },
    ]);
  });

  it("rejects world models that shadow bundled or module identities", async () => {
    await expect(
      saveWorldRulesProfile({
        healthModels: [worldTrack("d6e2.health.condition-track")],
        id: "shadow-rules",
        label: "Shadow Rules",
      }),
    ).rejects.toThrow("Bundled or module health model ID is reserved");

    const bundled = availableHealthModels().find(
      ({ id }) => id === "d6e2.health.condition-track",
    );
    expect(bundled?.kind).toBe("track");
    if (bundled?.kind !== "track") throw new Error("fixture");
    registerHealthModelContribution("echo", {
      ...structuredClone(bundled),
      id: "echo.health.condition-track",
      source: { kind: "module", ownerId: "echo" },
    });
    await expect(
      saveWorldRulesProfile({
        healthModels: [worldTrack("echo.health.condition-track")],
        id: "module-shadow-rules",
        label: "Module Shadow Rules",
      }),
    ).rejects.toThrow("Bundled or module health model ID is reserved");
  });

  it("requires explicit Actor mappings before a published state is removed", async () => {
    const states = [
      {
        allowsActions: true,
        id: "ready",
        label: "Ready",
        penaltyScore: 0,
        terminal: false,
      },
      {
        allowsActions: true,
        id: "hurt",
        label: "Hurt",
        penaltyScore: 3,
        terminal: false,
      },
      {
        allowsActions: false,
        id: "down",
        label: "Down",
        penaltyScore: 6,
        terminal: true,
      },
    ] as const;
    const model = {
      ...worldTrack("grit-rules.health.grit"),
      track: {
        ...worldTrack("grit-rules.health.grit").track,
        damageTransitions: generateMonotonicDamageTransitions(states, [
          "staggered",
          "stunned",
          "wounded",
          "mortally-wounded",
          "dead",
        ]),
        initialStateId: "ready",
        states,
      },
    };
    await saveWorldRulesProfile({
      healthModels: [model],
      id: "grit-rules",
      label: "Grit Rules",
      strategies: { health: model.id },
    });
    const actorSystem = {
      health: { tracks: { [model.id]: { stateId: "hurt" } } },
    };
    const actor = {
      id: "actor-1",
      system: actorSystem,
      type: "character",
      update: vi.fn((changes: Record<string, unknown>) => {
        actorSystem.health.tracks = changes[
          "system.health.tracks"
        ] as typeof actorSystem.health.tracks;
        return Promise.resolve();
      }),
    } as unknown as FoundryActorDocument;
    actors.push(actor);
    const replacement = worldTrack(model.id);
    await expect(
      saveWorldHealthModel("grit-rules", replacement),
    ).rejects.toThrow("explicit Actor replacement mapping");
    await saveWorldHealthModel("grit-rules", replacement, { hurt: "ready" });
    const storageKey = encodeURIComponent(model.id).replaceAll(".", "%2E");
    expect(actorSystem.health.tracks[storageKey]?.stateId).toBe("ready");
    await expect(deleteWorldHealthModel(model.id)).rejects.toThrow(
      "referenced by Grit Rules",
    );
    await activateWorldHealthModel("grit-rules", "d6e2.health.condition-track");
    await deleteWorldHealthModel(model.id);
    expect(actorSystem.health.tracks[storageKey]?.stateId).toBe("ready");
  });

  it("keeps every world Health Model lifecycle mutation GM-only", async () => {
    const model = worldTrack("grit-rules.health.grit");
    await saveWorldRulesProfile({
      healthModels: [model],
      id: "grit-rules",
      label: "Grit Rules",
      strategies: { health: "d6e2.health.condition-track" },
    });
    const copy = await duplicateWorldHealthModel(
      "grit-rules",
      model.id,
      "grit-rules.health.grit-copy",
    );
    expect(copy.id).toBe("grit-rules.health.grit-copy");
    expect(
      await importWorldHealthModel("grit-rules", exportWorldHealthModel(copy)),
    ).toEqual(copy);
    expect(
      (await activateWorldHealthModel("grit-rules", copy.id)).strategies.health,
    ).toBe(copy.id);
    await activateWorldHealthModel("grit-rules", "d6e2.health.condition-track");
    await deleteWorldHealthModel(copy.id);
    expect(
      storedWorldRulesProfiles().profiles["grit-rules"]?.healthModels.some(
        ({ id }) => id === copy.id,
      ),
    ).toBe(false);

    gameUser.isGM = false;
    await expect(saveWorldHealthModel("grit-rules", model)).rejects.toThrow(
      "GMRequired",
    );
    await expect(
      duplicateWorldHealthModel(
        "grit-rules",
        model.id,
        "grit-rules.health.denied",
      ),
    ).rejects.toThrow("GMRequired");
    await expect(
      importWorldHealthModel("grit-rules", exportWorldHealthModel(model)),
    ).rejects.toThrow("GMRequired");
    await expect(
      activateWorldHealthModel("grit-rules", model.id),
    ).rejects.toThrow("GMRequired");
    await expect(deleteWorldHealthModel(model.id)).rejects.toThrow(
      "GMRequired",
    );
  });

  it("atomically reassigns Rules Profiles and Actor states before deletion", async () => {
    const model = worldTrack("grit-rules.health.grit");
    await saveWorldRulesProfile({
      healthModels: [model],
      id: "grit-rules",
      label: "Grit Rules",
      strategies: { health: model.id },
    });
    const actorSystem = {
      health: {
        tracks: {
          [encodeURIComponent(model.id).replaceAll(".", "%2E")]: {
            stateId: "ready",
          },
        } as Record<string, { stateId: string }>,
      },
    };
    const actor = {
      id: "actor-delete",
      name: "Deletion test",
      system: actorSystem,
      type: "character",
      update: vi.fn((changes: Record<string, unknown>) => {
        actorSystem.health.tracks = changes[
          "system.health.tracks"
        ] as typeof actorSystem.health.tracks;
        return Promise.resolve();
      }),
    } as unknown as FoundryActorDocument;
    actors.push(actor);
    await deleteWorldHealthModelWithReassignment({
      modelId: model.id,
      replacementModelId: "d6e2.health.condition-track",
      stateReplacements: { ready: "healthy" },
    });
    const stored = storedWorldRulesProfiles().profiles["grit-rules"];
    expect(stored?.strategies.health).toBe("d6e2.health.condition-track");
    expect(stored?.healthModels).toEqual([]);
    expect(
      actorSystem.health.tracks[
        encodeURIComponent("d6e2.health.condition-track").replaceAll(".", "%2E")
      ]?.stateId,
    ).toBe("healthy");
    expect(
      actorSystem.health.tracks[
        encodeURIComponent(model.id).replaceAll(".", "%2E")
      ],
    ).toBeUndefined();
  });

  it("rolls Actor mappings back when atomic deletion persistence fails", async () => {
    const model = worldTrack("grit-rules.health.rollback");
    await saveWorldRulesProfile({
      healthModels: [model],
      id: "grit-rules",
      label: "Grit Rules",
      strategies: { health: model.id },
    });
    const key = encodeURIComponent(model.id).replaceAll(".", "%2E");
    const actorSystem = {
      health: { tracks: { [key]: { stateId: "ready" } } },
    };
    const actor = {
      id: "actor-rollback",
      name: "Rollback test",
      system: actorSystem,
      type: "character",
      update: vi.fn((changes: Record<string, unknown>) => {
        actorSystem.health.tracks = changes[
          "system.health.tracks"
        ] as typeof actorSystem.health.tracks;
        return Promise.resolve();
      }),
    } as unknown as FoundryActorDocument;
    actors.push(actor);
    vi.spyOn(game.settings, "set").mockRejectedValueOnce(
      new Error("settings write failed"),
    );
    await expect(
      deleteWorldHealthModelWithReassignment({
        modelId: model.id,
        replacementModelId: "d6e2.health.condition-track",
        stateReplacements: { ready: "healthy" },
      }),
    ).rejects.toThrow("settings write failed");
    expect(actorSystem.health.tracks[key]?.stateId).toBe("ready");
    expect(storedWorldRulesProfiles().profiles["grit-rules"]).toBeDefined();
  });

  it("preserves edited labels and values while fixing slot ids and order", async () => {
    const saved = await saveWorldRulesProfile({
      id: "table-scale",
      label: "Table Scale",
      difficultyLadder: [
        { id: "heroic", label: "Legendary", value: 42 },
        { id: "easy", label: "Routine", value: 8 },
      ],
    });
    expect(saved.difficultyLadder.map(({ id }) => id)).toEqual([
      "very-easy",
      "easy",
      "moderate",
      "difficult",
      "very-difficult",
      "heroic",
    ]);
    expect(saved.difficultyLadder[1]).toEqual({
      id: "easy",
      label: "Routine",
      value: 8,
    });
    expect(saved.difficultyLadder[5]).toEqual({
      id: "heroic",
      label: "Legendary",
      value: 42,
    });
  });

  it("normalizes legacy profiles without a scale slot to the current behavior", () => {
    const profile = normalizeRulesProfile({
      id: "legacy-profile",
      strategies: { movement: "open-d6.movement.relative" },
    });
    expect(profile.strategies.scale).toBe("d6e2.scale.ranked");
    expect(profile.strategies.movement).toBe("open-d6.movement.relative");
  });

  it("does not add a replacement resolution strategy while preserving a valid v3 world", async () => {
    const legacy = personalWorldRehearsalRulesLibrary();
    values.set("worldRulesProfiles", structuredClone(legacy));
    const world = await ensureWorldRulesProfilesStored();
    expect(world.profiles["new-rules-profile"]?.strategies).not.toHaveProperty(
      "rollResolution",
    );
    expect(writes).toEqual([]);
  });

  it("round-trips an embedded Homebrew detector and resolves it only by exact reference", () => {
    const builtIn = matchingDetector(D6_NEXUS_MATCHING_DETECTOR_ID);
    if (!builtIn) throw new Error("fixture missing");
    const evaluator = {
      ...structuredClone(builtIn.evaluator),
      id: "table.matches",
      label: "Table matches",
      source: { kind: "world" as const },
    };
    const profile = normalizeRulesProfile({
      id: "table-rules",
      label: "Table rules",
      matchingEvaluators: [evaluator],
      homebrew: {
        matchingRewards: [
          {
            awards: {},
            enabled: false,
            evaluatorId: evaluator.id,
            detectorId: worldMatchingDetectorId(evaluator.id),
            version: 1,
          },
        ],
      },
    });
    expect(importRulesProfile(exportRulesProfile(profile))).toMatchObject({
      matchingEvaluators: [{ id: "table.matches" }],
      homebrew: {
        matchingRewards: [
          { detectorId: worldMatchingDetectorId(evaluator.id) },
        ],
      },
    });
    expect(
      matchingDetectorForProfile(profile, worldMatchingDetectorId(evaluator.id))
        ?.evaluator.id,
    ).toBe(evaluator.id);
    expect(
      matchingDetectorForProfile(
        { ...profile, matchingEvaluators: [] },
        worldMatchingDetectorId(evaluator.id),
      ),
    ).toBeNull();
  });

  it("rejects malformed imports before world storage is written", () => {
    const before = values.get("worldRulesProfiles");
    expect(() =>
      importRulesProfile({
        kind: "d6-system-2e.rules-profile",
        profile: { id: "broken", label: "Broken", version: 3 },
        version: 3,
      }),
    ).toThrow("Invalid Rules Profile contract");
    expect(values.get("worldRulesProfiles")).toBe(before);
  });

  it("diagnoses unavailable strategies and unmet declarative constraints", () => {
    const profile = normalizeRulesProfile({
      constraints: [
        {
          assertion: { equals: true, key: "pips", kind: "setting" },
          id: "needs-pips",
          message: "Enable Pips.",
        },
      ],
      id: "diagnostic-profile",
      strategies: { retries: "module.missing-retry" },
    });
    expect(rulesProfileDiagnostics(profile, () => false)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unavailable-strategy" }),
        expect.objectContaining({
          code: "constraint-failed",
          message: "Enable Pips.",
        }),
      ]),
    );
  });

  it("diagnoses an unavailable optional scale strategy", () => {
    const profile = normalizeRulesProfile({
      id: "unknown-scale",
      strategies: { scale: "module.scale.unavailable" },
    });
    expect(rulesProfileDiagnostics(profile)).toContainEqual(
      expect.objectContaining({
        code: "unavailable-strategy",
        slot: "scale",
      }),
    );
  });

  it("deletes only inactive world-owned profiles", async () => {
    await saveWorldRulesProfile({ id: "first-world", label: "First" });
    await saveWorldRulesProfile({ id: "second-world", label: "Second" });
    await selectRulesProfile("second-world");
    await expect(deleteWorldRulesProfile("second-world")).rejects.toThrow(
      "Active Rules Profile cannot be deleted",
    );
    await expect(deleteWorldRulesProfile("second-edition")).rejects.toThrow(
      "not world-owned",
    );
    await deleteWorldRulesProfile("first-world");
    expect(
      (
        values.get("worldRulesProfiles") as {
          profiles: Record<string, unknown>;
        }
      ).profiles["first-world"],
    ).toBeUndefined();
  });
});
