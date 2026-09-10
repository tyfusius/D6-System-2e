import { rollSkill } from "./rolls/roll-service";
import * as pipRules from "../settings/pip-rules";
import { combinedActionBlocksRoll } from "./combined-action-state";
import { firstEditionGenreProfileRegistry } from "../registries/first-edition-genre-profiles";
import {
  currentActiveAttributeDefinitions,
  currentAttributeRole,
  currentAttributeCreationRuntime,
} from "../settings/attributes";
import { missingSkillSources } from "../content/skill-catalog";
import { availableSettingProfiles } from "../settings/setting-profile";
import {
  rulesProfileStrategyVariantLabel,
  rulesProfileStrategyVariants,
} from "../settings/rules-profile-strategy-variants";
import translations from "../../../../lang/en.json";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register1876Contributions } from "../../../western1876-companion-d6-system-2e/src/register";
import {
  MODULE_ID,
  PRESET_ID,
} from "../../../western1876-companion-d6-system-2e/src/module";
import { create1876RulesProfile } from "../../../western1876-companion-d6-system-2e/src/profiles";
import {
  availableRulesProfiles,
  rulesProfileRegistry,
  resetRulesProfileLibraryForTests,
  rulesProfileDiagnostics,
  normalizeRulesProfile,
} from "../settings/rules-profile-library";
import {
  settingProfileRegistry,
  resetSettingProfileRegistryForTests,
} from "../settings/setting-profile";
import {
  settingProfileFontRegistry,
  resetSettingProfileFontRegistryForTests,
} from "../settings/setting-profile-typography";
import {
  profilePresetRegistry,
  resetProfilePresetRegistryForTests,
} from "../registries/profile-presets";
import {
  activateProfilePreset,
  previewProfilePreset,
} from "./profile-preset-service";
import { currentActionEconomyRuntimeStrategy } from "../settings/action-economy";
import { currentInitiativeRuntimeStrategy } from "../settings/initiative";
// Stop after the production Skill pool calculation, before dialogs or dice.
vi.mock("./combined-action-state", () => ({
  combinedActionBlocksRoll: vi.fn(() => true),
}));
const stored = new Map<string, unknown>();
const localize = (key: string) => key;
function selection() {
  const preset = profilePresetRegistry
    .current()
    .find((entry) => entry.preset.id === PRESET_ID);
  if (!preset) throw new Error("Actual 1876 preset missing");
  return preset.preset.selection;
}
beforeEach(() => {
  stored.clear();
  stored.set("firstEditionGenrePackage", "open-d6-space-d6-system-2e");
  stored.set("worldRulesProfiles", {
    version: 5,
    activeProfileId: "second-edition",
    profiles: {},
  });
  stored.set("worldSettingProfiles", {
    version: 5,
    activeProfileId: "d6-system-second-edition",
    profiles: {},
  });
  vi.stubGlobal("game", {
    user: { isGM: true },
    i18n: { localize },
    settings: {
      get: (_scope: string, key: string) => stored.get(key),
      set: (_scope: string, key: string, value: unknown) => {
        stored.set(key, value);
        return Promise.resolve(value);
      },
    },
  });
  vi.stubGlobal("Hooks", { callAll: vi.fn() });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true })),
  );
  register1876Contributions(
    {
      apiVersion: 2,
      firstEditionGenreProfiles: firstEditionGenreProfileRegistry,
      systemId: "d6-system-2e",
      rulesProfileRegistry,
      settingProfileRegistry,
      settingProfileFontRegistry,
      profilePresetRegistry,
    },
    localize,
  );
});
afterEach(() => {
  firstEditionGenreProfileRegistry.unregisterOwner(MODULE_ID);
  resetRulesProfileLibraryForTests();
  resetSettingProfileRegistryForTests();
  resetSettingProfileFontRegistryForTests();
  resetProfilePresetRegistryForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("actual 1876 companion preset activation compatibility", () => {
  it("uses embedded Skill parents and adds each improvement once in the actual rollSkill path", async () => {
    await activateProfilePreset(selection());
    vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
    const seeded = missingSkillSources(new Set(), "open-d6");
    const skills = seeded.map((source, index) => ({
      ...source,
      id: `skill-${index}`,
      name: String(source.name),
      system: {
        ...(source.system as Record<string, unknown>),
        key: String((source.system as Record<string, unknown>).key),
        score: Number((source.system as Record<string, unknown>).score),
      },
    }));
    const actor = {
      id: "disposable-1876",
      name: "Disposable 1876",
      system: {
        attributes: {
          coordination: { score: 8 },
          knowledge: { score: 10 },
          presence: { score: 7 },
        },
      },
      items: {
        contents: skills,
        get: (id: string) => skills.find((skill) => skill.id === id),
      },
    };
    const combine = vi.spyOn(pipRules, "currentCombinedPipScore");
    const handling = skills.filter((skill) =>
      skill.name.startsWith("Handling:"),
    );
    expect(new Set(handling.map((skill) => skill.system.key)).size).toBe(8);
    const first = handling[0];
    const second = handling[1];
    if (!first || !second) throw new Error("Expected separate Handling fields");
    const before = structuredClone(second);
    first.system.score = 3;
    const cases = [
      {
        skill: skills.find((skill) => skill.name === "Firearms"),
        base: 8,
        improvement: 0,
      },
      {
        skill: skills.find((skill) => skill.name === "Medicine"),
        base: 10,
        improvement: 0,
      },
      {
        skill: skills.find((skill) => skill.name === "Demolition"),
        base: 10,
        improvement: 0,
      },
      { skill: first, base: 7, improvement: 3 },
      { skill: second, base: 7, improvement: 0 },
    ];
    for (const { skill, base, improvement } of cases) {
      if (!skill) throw new Error("Expected actual companion Skill");
      combine.mockClear();
      await expect(rollSkill(actor, skill.id)).resolves.toBeNull();
      expect(combine).toHaveBeenCalledExactlyOnceWith(base, improvement);
      expect(combine.mock.results[0]?.value).toBe(base + improvement);
      expect(combinedActionBlocksRoll).toHaveBeenLastCalledWith(
        actor,
        "skill",
        skill.id,
        undefined,
      );
    }
    expect(second).toEqual(before);
  });
  it("previews without writes, then transactionally activates the registered pair and exact runtimes", async () => {
    const requested = selection();
    const set = vi.spyOn(game.settings, "set");
    const profile = availableRulesProfiles().find(
      (p) => p.id === requested.rulesProfileId,
    );
    if (!profile) throw new Error("Actual Rules Profile missing");
    expect(rulesProfileDiagnostics(profile)).toEqual([]);
    await expect(previewProfilePreset(requested)).resolves.toMatchObject({
      changedCount: 2,
      selection: requested,
    });
    expect(set).not.toHaveBeenCalled();
    await expect(activateProfilePreset(requested)).resolves.toMatchObject({
      rulesProfile: { id: requested.rulesProfileId },
      settingProfile: { profile: { id: requested.settingProfileId } },
    });
    expect(stored.get("worldRulesProfiles")).toMatchObject({
      activeProfileId: requested.rulesProfileId,
    });
    expect(stored.get("worldSettingProfiles")).toMatchObject({
      activeProfileId: requested.settingProfileId,
    });
    expect(currentActionEconomyRuntimeStrategy()).toMatchObject({
      id: "open-d6.action-economy.segmented",
      turnScheduling: "round-robin-segments",
    });
    expect(currentInitiativeRuntimeStrategy()).toMatchObject({
      id: "open-d6.initiative.perception-reflexes",
      ordering: "rolled-descending",
    });
    expect(currentActiveAttributeDefinitions().map((a) => a.id)).toEqual([
      "reflexes",
      "coordination",
      "physique",
      "knowledge",
      "perception",
      "presence",
    ]);
    expect(currentAttributeRole("strength")).toBe("physique");
    expect(currentAttributeCreationRuntime()).toMatchObject({
      attributeBudgetScore: 54,
      skillBudgetScore: 21,
    });
    const skills = missingSkillSources(new Set(), "open-d6");
    expect(skills).toHaveLength(44);
    expect(skills.find((s) => s.name === "Firearms")).toMatchObject({
      system: { attributeId: "coordination", score: 0 },
    });
    expect(skills.find((s) => s.name === "Medicine")).toMatchObject({
      system: { attributeId: "knowledge", score: 0 },
    });
    expect(skills.find((s) => s.name === "Demolition")).toMatchObject({
      system: { attributeId: "knowledge", score: 0 },
    });
    const handling = skills.filter((s) =>
      String(s.name).startsWith("Handling:"),
    );
    expect(handling).toHaveLength(8);
    for (const skill of handling)
      expect(skill).toMatchObject({
        type: "skill",
        system: { attributeId: "presence" },
      });
    expect(
      availableSettingProfiles().filter(
        (entry) => entry.profile.id === MODULE_ID,
      ),
    ).toHaveLength(0);
    expect(
      availableSettingProfiles().filter(
        (entry) => entry.profile.id === requested.settingProfileId,
      ),
    ).toHaveLength(1);
    expect(stored.get("firstEditionGenrePackage")).toBe(
      "open-d6-space-d6-system-2e",
    );
    set.mockClear();
    await expect(activateProfilePreset(requested)).resolves.toMatchObject({
      preview: { changedCount: 0 },
    });
    expect(set).not.toHaveBeenCalled();
  });
  it("supplies existing human labels for both variant selectors and capability summaries", () => {
    for (const variant of rulesProfileStrategyVariants) {
      const key = rulesProfileStrategyVariantLabel(variant.id);
      expect(key).toBeDefined();
      const label = translations[key as keyof typeof translations];
      expect(typeof label).toBe("string");
      expect(label).not.toBe(key);
      expect(label).not.toContain(variant.id);
    }
    expect(
      rulesProfileStrategyVariantLabel("open-d6.action-economy.segmented"),
    ).toBe("D6E2.Settings.Capabilities.Strategy.OpenD6FlexibleActionAllotment");
    expect(
      rulesProfileStrategyVariantLabel(
        "open-d6.initiative.perception-reflexes",
      ),
    ).toBe(
      "D6E2.Settings.Capabilities.Strategy.OpenD6PerceptionReflexesInitiative",
    );
  });
  it("still rejects unknown and wrong-slot variants before either selection is written", async () => {
    const original = create1876RulesProfile(localize);
    const before = structuredClone([...stored]);
    for (const strategies of [
      {
        ...original.strategies,
        initiative: "open-d6.initiative.unimplemented",
      },
      {
        ...original.strategies,
        initiative: "open-d6.action-economy.segmented",
        actionEconomy: "open-d6.initiative.perception-reflexes",
      },
    ]) {
      rulesProfileRegistry.register(
        MODULE_ID,
        normalizeRulesProfile({ ...original, strategies }),
      );
      await expect(previewProfilePreset(selection())).rejects.toThrow();
      await expect(activateProfilePreset(selection())).rejects.toThrow();
      expect([...stored]).toEqual(before);
    }
  });
  it("preserves declared constraints during actual preset preflight", async () => {
    const original = create1876RulesProfile(localize);
    rulesProfileRegistry.register(
      MODULE_ID,
      normalizeRulesProfile({
        ...original,
        constraints: [
          {
            id: "required-initiative",
            message: "Constraint must still fail",
            assertion: {
              kind: "strategy",
              slot: "initiative",
              equals: "open-d6.initiative.perception",
            },
          },
        ],
      }),
    );
    const set = vi.spyOn(game.settings, "set");
    await expect(activateProfilePreset(selection())).rejects.toThrow(
      "Constraint must still fail",
    );
    expect(set).not.toHaveBeenCalled();
  });
});
