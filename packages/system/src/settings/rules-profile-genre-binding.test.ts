import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { firstEditionGenreProfileRegistry } from "../registries/first-edition-genre-profiles";
import { currentFirstEditionGenreProfile } from "./first-edition-genre-profile";
import {
  currentActiveAttributeDefinitions,
  currentAttributeRole,
  currentAttributeCreationRuntime,
} from "./attributes";
import {
  normalizeRulesProfile,
  normalizeWorldRulesProfiles,
  rulesProfileRegistry,
  resetRulesProfileLibraryForTests,
  duplicateRulesProfile,
  exportRulesProfile,
  importRulesProfile,
  rulesProfileDiagnostics,
} from "./rules-profile-library";
import {
  settingProfileRegistry,
  resetSettingProfileRegistryForTests,
  normalizeSettingProfile,
  availableSettingProfiles,
} from "./setting-profile";
import {
  previewProfilePreset,
  activateProfilePreset,
} from "../foundry/profile-preset-service";
import { missingSkillSources } from "../content/skill-catalog";
const owner = "test-bound-genre";
const ids = [
  "reflexes",
  "coordination",
  "physique",
  "knowledge",
  "perception",
  "presence",
];
const binding = { version: 1 as const, id: owner };
const values = new Map<string, unknown>();
const setSetting = vi.fn((_scope: string, key: string, value: unknown) => {
  values.set(key, value);
  return Promise.resolve(value);
});
const genre = () => ({
  version: 1 as const,
  id: owner,
  genreId: owner,
  label: "Bound genre",
  attributes: ids.map((id) => ({ id, label: `Genre ${id}` })),
  roles: {
    initiative: "perception",
    knowledge: "knowledge",
    strength: "physique",
  },
  attributeBudgetScore: 54,
  skillBudgetScore: 21,
  skills: [],
});
const rules = () =>
  normalizeRulesProfile({
    id: "bound-rules",
    source: { kind: "module", ownerId: owner },
    firstEditionGenreProfile: binding,
    strategies: { attributes: "open-d6.attributes.six-attribute" },
  });
const setting = () =>
  normalizeSettingProfile({
    id: "bound-setting",
    label: "Bound Setting",
    originRulesFamily: "open-d6-first-edition",
    attributes: [...ids]
      .reverse()
      .map((id) => ({ id, label: `Setting ${id}` })),
    skills: [
      ["firearms", "coordination"],
      ["medicine", "knowledge"],
      ["demolition", "knowledge"],
      ["handling-horses", "presence"],
      ["handling-cattle", "presence"],
    ].map(([key, attributeId]) => ({
      key,
      attributeId,
      name: key,
      description: `<p>${key} working draft; no printed page.</p>`,
      img: "icons/svg/dice-target.svg",
      training: "standard",
    })),
  });
const selection = {
  version: 1 as const,
  rulesProfileId: "bound-rules",
  settingProfileId: "bound-setting",
};
beforeEach(() => {
  values.clear();
  setSetting.mockClear();
  values.set("firstEditionGenrePackage", "open-d6-space-d6-system-2e");
  values.set("worldRulesProfiles", {
    version: 5,
    activeProfileId: "second-edition",
    profiles: {},
  });
  values.set("worldSettingProfiles", {
    version: 5,
    activeProfileId: "d6-system-second-edition",
    profiles: {},
  });
  vi.stubGlobal("game", {
    user: { isGM: true },
    i18n: { localize: (k: string) => k },
    settings: {
      get: (_scope: string, key: string) => values.get(key),
      set: setSetting,
    },
  });
  vi.stubGlobal("Hooks", { callAll: vi.fn() });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true })),
  );
  firstEditionGenreProfileRegistry.register(owner, genre());
  rulesProfileRegistry.register(owner, rules());
  settingProfileRegistry.register(owner, setting());
});
afterEach(() => {
  firstEditionGenreProfileRegistry.unregisterOwner(owner);
  firstEditionGenreProfileRegistry.unregisterOwner("unbound-genre");
  resetRulesProfileLibraryForTests();
  resetSettingProfileRegistryForTests();
  vi.unstubAllGlobals();
});
describe("portable Rules Profile genre binding", () => {
  it("preserves the optional extension through old-state upgrade, normalization, copy, export and import", () => {
    const legacy = normalizeWorldRulesProfiles({
      version: 1,
      profiles: { old: { id: "old" } },
    });
    expect(legacy.profiles.old?.firstEditionGenreProfile).toBeUndefined();
    expect(normalizeWorldRulesProfiles(legacy)).toEqual(legacy);
    const profile = rules();
    expect(normalizeRulesProfile(profile)).toEqual(profile);
    expect(duplicateRulesProfile(profile).firstEditionGenreProfile).toEqual(
      binding,
    );
    expect(
      importRulesProfile(exportRulesProfile(profile)).firstEditionGenreProfile,
    ).toEqual(binding);
    const raw = {
      version: 5,
      profiles: {
        copied: {
          ...profile,
          id: "copied",
          source: { kind: "world" },
          firstEditionGenreProfile: { version: 2, id: owner },
        },
      },
    };
    const before = structuredClone(raw);
    expect(() => normalizeWorldRulesProfiles(raw)).toThrow(
      "Unsupported First Edition",
    );
    expect(raw).toEqual(before);
    for (const value of [null, {}, { version: 1, id: "bad id" }])
      expect(() =>
        normalizeRulesProfile({ ...profile, firstEditionGenreProfile: value }),
      ).toThrow();
    expect(setSetting).not.toHaveBeenCalled();
  });
  it("activates only the paired selections and overrides legacy Space with exact ordered Attributes, roles and budgets", async () => {
    await previewProfilePreset(selection);
    expect(setSetting).not.toHaveBeenCalled();
    await activateProfilePreset(selection);
    expect(setSetting.mock.calls.map((call) => call[1])).toEqual([
      "worldRulesProfiles",
      "worldSettingProfiles",
    ]);
    expect(values.get("firstEditionGenrePackage")).toBe(
      "open-d6-space-d6-system-2e",
    );
    expect(currentFirstEditionGenreProfile().id).toBe(owner);
    expect(currentActiveAttributeDefinitions()).toEqual(
      ids.map((id) => ({ id, label: `Setting ${id}` })),
    );
    expect(currentAttributeRole("initiative")).toBe("perception");
    expect(currentAttributeRole("strength")).toBe("physique");
    expect(currentAttributeRole("knowledge")).toBe("knowledge");
    expect(currentAttributeCreationRuntime()).toMatchObject({
      attributeBudgetScore: 54,
      skillBudgetScore: 21,
    });
    values.set("worldRulesProfiles", {
      version: 5,
      profiles: {},
      activeProfileId: "open-d6",
    });
    expect(currentFirstEditionGenreProfile().id).toBe(
      "open-d6-space-d6-system-2e",
    );
  });
  it("does not synthesize a duplicate library for an explicitly paired owner, and preserves legacy synthesis", () => {
    expect(
      availableSettingProfiles().some((entry) => entry.profile.id === owner),
    ).toBe(false);
    expect(
      availableSettingProfiles().filter(
        (entry) => entry.profile.id === "bound-setting",
      ),
    ).toHaveLength(1);
    firstEditionGenreProfileRegistry.register("unbound-genre", {
      ...genre(),
      id: "unbound-genre",
      genreId: "unbound-genre",
    });
    expect(
      availableSettingProfiles().some(
        (entry) => entry.profile.id === "unbound-genre",
      ),
    ).toBe(true);
  });
  it("seeds only the bound Setting catalog, preserving metadata and independent Handling fields without page invention", async () => {
    await activateProfilePreset(selection);
    const sources = missingSkillSources(new Set(["medicine"]), "open-d6");
    expect(sources).toHaveLength(4);
    expect(sources.map((s) => s.name)).toEqual([
      "firearms",
      "demolition",
      "handling-horses",
      "handling-cattle",
    ]);
    expect(sources[0]).toMatchObject({
      img: "icons/svg/dice-target.svg",
      system: {
        attributeId: "coordination",
        score: 0,
        training: "standard",
        description: "<p>firearms working draft; no printed page.</p>",
        source: { page: 0 },
      },
    });
    for (const source of sources.filter((s) =>
      String(s.name).startsWith("handling-"),
    ))
      expect(source).toMatchObject({
        type: "skill",
        system: { attributeId: "presence", score: 0 },
      });
    expect(
      missingSkillSources(
        new Set(setting().skills.map((s) => s.key)),
        "open-d6",
      ),
    ).toEqual([]);
    settingProfileRegistry.register(owner, { ...setting(), skills: [] });
    expect(missingSkillSources(new Set(), "open-d6")).toEqual([]);
  });
  it("preserves both selections when a bound provider or compatible Setting mapping is unavailable", async () => {
    const before = structuredClone([...values]);
    firstEditionGenreProfileRegistry.unregisterOwner(owner);
    await expect(activateProfilePreset(selection)).rejects.toThrow(
      "unavailable",
    );
    expect([...values]).toEqual(before);
    firstEditionGenreProfileRegistry.register(owner, genre());
    settingProfileRegistry.register(owner, {
      ...setting(),
      skills: [
        {
          ...setting().skills[0],
          key: "wrong-parent",
          name: "Wrong parent",
          attributeId: "brawn",
          description: "",
          img: "icons/svg/dice-target.svg",
          training: "standard",
        },
      ],
    });
    await expect(activateProfilePreset(selection)).rejects.toThrow(
      "outside the bound genre",
    );
    expect([...values]).toEqual(before);
    expect(
      rulesProfileDiagnostics(
        normalizeRulesProfile({
          ...rules(),
          strategies: { attributes: "d6e2.attributes.campaign-profile" },
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unavailable-genre" }),
      ]),
    );
    expect(setSetting).not.toHaveBeenCalled();
  });
  it("rejects a bound genre whose required Attribute is absent from the selected Setting vocabulary", async () => {
    firstEditionGenreProfileRegistry.register(owner, {
      ...genre(),
      attributes: [
        ...genre().attributes,
        { id: "composure", label: "Composure" },
      ],
    });
    const before = structuredClone([...values]);
    await expect(previewProfilePreset(selection)).rejects.toThrow(
      "lacks bound Attributes: composure",
    );
    await expect(activateProfilePreset(selection)).rejects.toThrow(
      "lacks bound Attributes: composure",
    );
    expect([...values]).toEqual(before);
    expect(setSetting).not.toHaveBeenCalled();
  });
  it("does not fall back to Space after an active bound provider disappears", async () => {
    await activateProfilePreset(selection);
    const before = structuredClone([...values]);
    firstEditionGenreProfileRegistry.unregisterOwner(owner);
    expect(() => currentFirstEditionGenreProfile()).toThrow("unavailable");
    expect(() => missingSkillSources(new Set(), "open-d6")).toThrow(
      "unavailable",
    );
    expect([...values]).toEqual(before);
  });
});
