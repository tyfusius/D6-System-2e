import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, unknown>();
const writes: string[] = [];
vi.stubGlobal("game", {
  i18n: { localize: (key: string) => key },
  settings: {
    get: (_system: string, key: string) => values.get(key),
    set: (_system: string, key: string, value: unknown) => {
      writes.push(key);
      values.set(key, value);
      return Promise.resolve(value);
    },
  },
});
vi.stubGlobal("Hooks", { callAll: vi.fn() });

import {
  availableRulesProfiles,
  currentConfiguredRulesProfile,
  deleteWorldRulesProfile,
  duplicateRulesProfile,
  ensureWorldRulesProfilesStored,
  evaluateRulesPredicate,
  exportRulesProfile,
  importRulesProfile,
  normalizeRulesProfile,
  registerRulesProfileContribution,
  resetRulesProfileLibraryForTests,
  rulesProfileDiagnostics,
  rulesProfileSettingsWorkspace,
  selectRulesProfile,
  saveNewWorldRulesProfile,
  saveWorldRulesProfile,
  storedWorldRulesProfiles,
} from "./rules-profile-library";

describe("versioned Rules Profile library", () => {
  beforeEach(() => {
    values.clear();
    writes.length = 0;
    resetRulesProfileLibraryForTests();
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
    expect(first.version).toBe(2);
    expect(first.profiles["table-rules"]?.difficultyLadder).toHaveLength(6);
    expect(writes).toEqual(["worldRulesProfiles"]);
    await ensureWorldRulesProfilesStored();
    expect(writes).toEqual(["worldRulesProfiles"]);
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
    const source = currentConfiguredRulesProfile();
    const first = duplicateRulesProfile(source);
    expect(first.id).toBe("second-edition-copy");
    expect(first.source).toEqual({ kind: "world" });
    await saveWorldRulesProfile(first);
    expect(duplicateRulesProfile(source).id).toBe("second-edition-copy-2");
  });

  it("round-trips a portable export without overwriting an existing id", async () => {
    const source = await saveWorldRulesProfile({
      ...currentConfiguredRulesProfile(),
      id: "table-rules",
      label: "Table Rules",
      source: { kind: "world" },
    });
    const imported = importRulesProfile(exportRulesProfile(source));
    expect(imported.id).toBe("table-rules-2");
    expect(imported.source).toEqual({ kind: "world" });
    expect(imported.strategies).toEqual(source.strategies);
    expect(imported.difficultyLadder).toEqual(source.difficultyLadder);
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

  it("rejects malformed imports before world storage is written", () => {
    const before = values.get("worldRulesProfiles");
    expect(() =>
      importRulesProfile({
        kind: "d6-system-2e.rules-profile",
        profile: { id: "broken", label: "Broken", version: 2 },
        version: 2,
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
