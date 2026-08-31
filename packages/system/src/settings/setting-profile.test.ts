import { afterEach, describe, expect, it, vi } from "vitest";
import { createEchoSettingProfile } from "../../../echod6-companion-d6-system-2e/src/setting-profile";
import { firstEditionGenreProfileRegistry } from "../registries/first-edition-genre-profiles";
import {
  resetThemeRegistryForTests,
  themeRegistry,
} from "../registries/themes";
import {
  createSettingProfile,
  D6_SYSTEM_2E_CLASSIC_SETTING_PALETTE,
  D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE,
  deleteWorldSettingProfile,
  availableSettingProfiles,
  currentSettingProfileSelection,
  currentSettingActiveAttributes,
  defaultSettingProfile,
  duplicateSettingProfile,
  editableCurrentSettingProfile,
  ensureWorldSettingProfilesStored,
  exportSettingProfile,
  importSettingProfile,
  migrateLegacyWorldTerminologyOverrides,
  normalizeSettingProfile,
  normalizeWorldSettingProfiles,
  registerSettingProfileContribution,
  resetSettingProfileRegistryForTests,
  saveCurrentSettingProfile,
  saveWorldSettingProfile,
  selectSettingProfile,
  settingProfileColorContrast,
  settingHealthStateLabel,
  synchronizedSettingProfileColor,
  validateSettingProfilePalette,
} from "./setting-profile";
import { D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY } from "./setting-profile-typography";

afterEach(() => {
  resetSettingProfileRegistryForTests();
  resetThemeRegistryForTests();
  firstEditionGenreProfileRegistry.unregisterOwner("open-d6-adventure-test");
  for (const ownerId of [
    "open-d6-adventure-d6-system-2e",
    "open-d6-fantasy-d6-system-2e",
    "open-d6-space-d6-system-2e",
  ]) {
    firstEditionGenreProfileRegistry.unregisterOwner(ownerId);
  }
  vi.unstubAllGlobals();
});

describe("world Setting Profile contract", () => {
  it("resolves tracked overrides and the pool-health Healthy fallback without raw localization keys", () => {
    vi.stubGlobal("game", {
      i18n: {
        localize: (key: string) =>
          key === "D6E2.Condition.Healthy" ? "Healthy" : key,
      },
      settings: { get: () => undefined },
    });
    const tracked = normalizeSettingProfile({
      healthLabels: {
        "free-d6-health": {
          states: { healthy: "Ready" },
        },
      },
      id: "free-d6-tracked-label-test",
      label: "FreeD6 tracked label test",
    });
    const pooled = normalizeSettingProfile({
      id: "free-d6-pool-label-test",
      label: "FreeD6 pool label test",
    });

    expect(
      settingHealthStateLabel(
        "free-d6-health",
        "healthy",
        "D6E2.Condition.Healthy",
        tracked,
      ),
    ).toBe("Ready");
    expect(
      settingHealthStateLabel(
        "free-d6-health",
        "healthy",
        "D6E2.Condition.Healthy",
        pooled,
      ),
    ).toBe("Healthy");
  });

  it("adapts installed Open D6 genre profiles into bundled Setting Profiles", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });
    vi.stubGlobal("Hooks", { callAll: vi.fn() });
    firstEditionGenreProfileRegistry.register("open-d6-adventure-test", {
      attributeBudgetScore: 54,
      attributes: [
        { id: "reflexes", label: "Reflexes" },
        { id: "coordination", label: "Coordination" },
        { id: "physique", label: "Physique" },
        { id: "knowledge", label: "Knowledge" },
        { id: "perception", label: "Perception" },
        { id: "presence", label: "Presence" },
      ],
      genreId: "open-d6-adventure-test",
      id: "open-d6-adventure-test",
      label: "Open D6 Adventure",
      roles: {
        initiative: "perception",
        knowledge: "knowledge",
        strength: "physique",
      },
      skillBudgetScore: 21,
      skills: [],
      version: 1,
    });

    const resolved = availableSettingProfiles().find(
      ({ profile }) => profile.id === "open-d6-adventure-test",
    );
    expect(resolved).toMatchObject({
      ownerId: "open-d6-adventure-test",
      profile: {
        label: "Open D6 Adventure",
        logo: "systems/d6-system-2e/assets/ui/d6-pause-mark.svg",
      },
      source: "module",
    });
    expect(resolved?.profile.attributes.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["coordination", "physique", "reflexes"]),
    );
    expect(
      resolved?.profile.attributes.every(
        (attribute) => !("active" in attribute),
      ),
    ).toBe(true);
  });

  it("brands only the exact first-party Open D6 Setting Profiles with the Open D6 mark", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });
    vi.stubGlobal("Hooks", { callAll: vi.fn() });

    for (const [ownerId, label] of [
      ["open-d6-adventure-d6-system-2e", "Open D6 Adventure"],
      ["open-d6-fantasy-d6-system-2e", "Open D6 Fantasy"],
      ["open-d6-space-d6-system-2e", "Open D6 Space"],
    ] as const) {
      firstEditionGenreProfileRegistry.register(ownerId, {
        attributeBudgetScore: 54,
        attributes: [
          { id: "reflexes", label: "Reflexes" },
          { id: "coordination", label: "Coordination" },
          { id: "physique", label: "Physique" },
          { id: "knowledge", label: "Knowledge" },
          { id: "perception", label: "Perception" },
          { id: "presence", label: "Presence" },
        ],
        genreId: ownerId,
        id: ownerId,
        label,
        roles: {
          initiative: "perception",
          knowledge: "knowledge",
          strength: "physique",
        },
        skillBudgetScore: 21,
        skills: [],
        version: 1,
      });
    }

    const openD6Logo =
      "systems/d6-system-2e/assets/ui/open-d6-profile-mark.svg";
    expect(defaultSettingProfile("open-d6-first-edition").logo).toBe(
      openD6Logo,
    );
    expect(defaultSettingProfile("open-d6-first-edition").palette).toEqual(
      D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE,
    );
    expect(defaultSettingProfile("d6-system-second-edition").palette).toEqual(
      D6_SYSTEM_2E_CLASSIC_SETTING_PALETTE,
    );
    expect(defaultSettingProfile("open-d6-first-edition").typography).toEqual(
      D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY,
    );
    expect(
      defaultSettingProfile("d6-system-second-edition").typography,
    ).toEqual(D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY);
    expect(defaultSettingProfile("d6-system-second-edition").logo).toBe(
      "systems/d6-system-2e/assets/ui/d6-pause-mark.svg",
    );
    expect(defaultSettingProfile("open-d6-first-edition").logoAsWatermark).toBe(
      false,
    );
    expect(
      defaultSettingProfile("d6-system-second-edition").logoAsWatermark,
    ).toBe(false);
    for (const ownerId of [
      "open-d6-adventure-d6-system-2e",
      "open-d6-fantasy-d6-system-2e",
      "open-d6-space-d6-system-2e",
    ]) {
      expect(
        availableSettingProfiles().find(({ profile }) => profile.id === ownerId)
          ?.profile.logo,
      ).toBe(openD6Logo);
      expect(
        availableSettingProfiles().find(({ profile }) => profile.id === ownerId)
          ?.profile.logoAsWatermark,
      ).toBe(false);
      expect(
        availableSettingProfiles().find(({ profile }) => profile.id === ownerId)
          ?.profile.palette,
      ).toEqual(D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE);
      expect(
        availableSettingProfiles().find(({ profile }) => profile.id === ownerId)
          ?.profile.typography,
      ).toEqual(D6_SYSTEM_2E_DEFAULT_SETTING_TYPOGRAPHY);
    }
  });

  it("keeps provider profiles palette-free unless they explicitly contribute colors", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });
    const profile = normalizeSettingProfile({
      id: "star-wars-d6-reup",
      label: "Star Wars D6",
      logo: "modules/starwarsd6-companion-d6-system-2e/art/branding/star-wars-outline.svg",
      originRulesFamily: "open-d6-first-edition",
      skills: [],
    });
    expect(profile.palette).toBeUndefined();
    expect(profile.typography).toBeUndefined();
  });

  it("preserves explicit typography through duplicate and strict export/import", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });
    const source = normalizeSettingProfile({
      id: "typographic-setting",
      label: "Typographic Setting",
      skills: [],
      typography: {
        body: "system/d6-interface",
        display: "system/system-sans",
      },
    });
    expect(duplicateSettingProfile(source).typography).toEqual(
      source.typography,
    );
    const exported = exportSettingProfile(source);
    expect(importSettingProfile(exported).typography).toEqual(
      source.typography,
    );
    expect(exported.fontDependencies).toEqual([
      expect.objectContaining({
        label: "D6 Humanist",
        ref: "system/d6-interface",
        source: "system",
      }),
      expect.objectContaining({
        label: "System Sans",
        ref: "system/system-sans",
        source: "system",
      }),
    ]);
    expect(JSON.stringify(exported)).not.toMatch(
      /(?:path|binary|data:|url\()/iu,
    );
  });

  it("rejects arbitrary typography ids on authored save and strict import", async () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined, set: vi.fn() },
    });
    const source = normalizeSettingProfile({
      id: "typography-validation",
      label: "Typography Validation",
      skills: [],
    });
    await expect(
      saveWorldSettingProfile({
        ...source,
        typography: { body: "system/d6-interface", display: "raw{css" },
      }),
    ).rejects.toThrow("typography display is malformed");
    expect(() =>
      importSettingProfile({
        ...exportSettingProfile(source),
        profile: {
          ...source,
          typography: { body: "system/d6-interface", display: "raw{css" },
        },
      }),
    ).toThrow("typography display is malformed");
  });

  it("validates strict colors and readable profile text deterministically", () => {
    expect(
      validateSettingProfilePalette(D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE),
    ).toEqual({
      valid: true,
    });
    expect(
      settingProfileColorContrast("#edfaff", "#07131b"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      validateSettingProfilePalette({
        ...D6_SYSTEM_2E_CLASSIC_SETTING_PALETTE,
        accent: "blue",
      }),
    ).toMatchObject({ field: "accent", reason: "hex", valid: false });
    expect(
      validateSettingProfilePalette({
        ...D6_SYSTEM_2E_CLASSIC_SETTING_PALETTE,
        text: "#0b0e13",
      }),
    ).toMatchObject({ field: "text", reason: "contrast", valid: false });
    expect(
      validateSettingProfilePalette({
        ...D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE,
        accent: "#f000f0",
        accentBright: "#b56bff",
      }),
    ).toEqual({ valid: true });
    expect(
      validateSettingProfilePalette({
        ...D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE,
        muted: "#9a968d",
      }),
    ).toMatchObject({
      field: "muted",
      reason: "contrast",
      surface: "panel",
      threshold: 4.5,
      valid: false,
    });
  });

  it("synchronizes complete picker and hex values without replacing incomplete typing", () => {
    expect(synchronizedSettingProfileColor("picker", "#00AEEE")).toBe(
      "#00aeee",
    );
    expect(synchronizedSettingProfileColor("hex", "#6DDAFF")).toBe("#6ddaff");
    expect(synchronizedSettingProfileColor("hex", "#6DDA")).toBeUndefined();
    expect(synchronizedSettingProfileColor("hex", "cyan")).toBeUndefined();
  });

  it("restores first-party Open D6 branding when an unavailable provider returns", () => {
    const ownerId = "open-d6-space-d6-system-2e";
    const profile = {
      attributeBudgetScore: 54,
      attributes: [
        { id: "agility", label: "Agility" },
        { id: "brawn", label: "Brawn" },
        { id: "mechanical", label: "Mechanical" },
        { id: "knowledge", label: "Knowledge" },
        { id: "perception", label: "Perception" },
        { id: "technical", label: "Technical" },
      ],
      genreId: ownerId,
      id: ownerId,
      label: "Open D6 Space",
      roles: {
        initiative: "perception",
        knowledge: "knowledge",
        strength: "brawn",
      },
      skillBudgetScore: 21,
      skills: [],
      version: 1 as const,
    };
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: {
        get: (_system: string, key: string) =>
          key === "worldSettingProfiles"
            ? { activeProfileId: ownerId, profiles: {}, version: 5 }
            : undefined,
      },
    });
    vi.stubGlobal("Hooks", { callAll: vi.fn() });

    firstEditionGenreProfileRegistry.register(ownerId, profile);
    expect(currentSettingProfileSelection()).toMatchObject({
      available: true,
      resolved: {
        profile: {
          id: ownerId,
          logo: "systems/d6-system-2e/assets/ui/open-d6-profile-mark.svg",
        },
      },
    });

    firstEditionGenreProfileRegistry.unregisterOwner(ownerId);
    expect(currentSettingProfileSelection()).toMatchObject({
      activeProfileId: ownerId,
      available: false,
      resolved: {
        profile: {
          id: "d6-system-second-edition",
          logo: "systems/d6-system-2e/assets/ui/d6-pause-mark.svg",
        },
      },
    });

    firstEditionGenreProfileRegistry.register(ownerId, profile);
    expect(currentSettingProfileSelection()).toMatchObject({
      available: true,
      resolved: {
        profile: {
          id: ownerId,
          logo: "systems/d6-system-2e/assets/ui/open-d6-profile-mark.svg",
        },
      },
    });
  });

  it("does not infer tintable branding from an Open D6 rules origin", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });
    const logo =
      "modules/starwarsd6-companion-d6-system-2e/art/branding/star-wars-outline.svg";
    const profile = normalizeSettingProfile({
      id: "star-wars-d6-reup",
      label: "Star Wars D6",
      logo,
      originRulesFamily: "open-d6-first-edition",
    });

    expect(profile.originRulesFamily).toBe("open-d6-first-edition");
    expect(profile.logo).toBe(logo);
  });

  it("preserves an intentionally empty Skill Library", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });

    const profile = normalizeSettingProfile(
      {
        attributes: [
          { active: true, id: "agility", label: "Reflexes" },
          { active: true, id: "brawn", label: "Strength" },
          { active: true, id: "knowledge", label: "Intellect" },
          { active: true, id: "perception", label: "Awareness" },
        ],
        id: "custom-world",
        label: "Custom World",
        skills: [],
        terminology: {
          attributes: { brawn: "Strength" },
          bodyPoints: { track: "Vitality" },
          conditions: { states: { wounded: "Hurt" } },
          resources: { heroPoints: "Force Points" },
          wounds: {
            states: { severelyWounded: "Badly Hurt" },
            track: "Wound Levels",
          },
        },
        wildDie: {
          one: { kind: "text", value: "!" },
          oneSound: "sounds/wild-one.mp3",
          six: { kind: "image", value: "images/wild-six.webp" },
          sixSound: "sounds/wild-six.mp3",
        },
      },
      "d6-system-second-edition",
    );

    expect(profile.skills).toEqual([]);
    expect(profile.attributes.find(({ id }) => id === "agility")).toEqual({
      id: "agility",
      label: "Reflexes",
    });
    expect(profile.wildDie.one).toEqual({ kind: "text", value: "!" });
    expect(profile.wildDie.six).toEqual({
      kind: "image",
      value: "images/wild-six.webp",
    });
    expect(profile.logoAsWatermark).toBe(true);
    expect(profile.terminology).toEqual({
      attributes: { brawn: "Strength" },
      bodyPoints: { track: "Vitality" },
      conditions: { states: { wounded: "Hurt" } },
      resources: { heroPoints: "Force Points" },
      wounds: {
        states: { severelyWounded: "Badly Hurt" },
        track: "Wound Levels",
      },
    });
  });

  it("rejects unsafe asset paths and duplicate Skill keys", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });

    const profile = normalizeSettingProfile(
      {
        logo: "https://example.invalid/logo.png",
        skills: [
          {
            attributeId: "agility",
            description: "Move precisely.",
            img: "../secret.png",
            key: "acrobatics",
            name: "Acrobatics",
            training: "standard",
          },
          {
            attributeId: "brawn",
            key: "acrobatics",
            name: "Duplicate",
          },
        ],
      },
      "d6-system-second-edition",
    );

    expect(profile.logo).toContain("d6-pause-mark.svg");
    expect(profile.skills).toHaveLength(1);
    expect(profile.skills[0]?.img).toBe(
      "systems/d6-system-2e/assets/icons/defaults/item-skill.png",
    );
  });

  it("preserves the contained-row logo presentation choice", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });

    const profile = normalizeSettingProfile(
      { logoAsWatermark: false },
      "d6-system-second-edition",
    );

    expect(profile.logoAsWatermark).toBe(false);
    expect(profile.attributes.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "acumen",
        "charisma",
        "coordination",
        "extranormal",
        "intellect",
        "physique",
        "presence",
        "reflexes",
      ]),
    );
  });

  it("preserves legacy missing-field watermark compatibility", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });

    expect(
      normalizeSettingProfile(
        { id: "legacy-profile", label: "Legacy Profile", skills: [] },
        "d6-system-second-edition",
      ).logoAsWatermark,
    ).toBe(true);
  });

  it("preserves missing legacy colors without materializing a world write", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });
    expect(
      normalizeSettingProfile({
        id: "legacy-profile",
        label: "Legacy Profile",
        skills: [],
      }).palette,
    ).toBeUndefined();
  });

  it("migrates both edition-owned profiles into one lossless world library", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });
    const world = normalizeWorldSettingProfiles(
      {
        firstEdition: {
          id: "echo",
          label: "Echo First Edition",
          rulesFamily: "open-d6-first-edition",
          skills: [],
        },
        secondEdition: {
          id: "echo",
          label: "Echo Second Edition",
          rulesFamily: "d6-system-second-edition",
          skills: [],
        },
        version: 1,
      },
      "d6-system-second-edition",
    );

    expect(world.version).toBe(5);
    expect(Object.values(world.profiles).map(({ label }) => label)).toEqual([
      "Echo First Edition",
      "Echo Second Edition",
    ]);
    expect(world.activeProfileId).toBe("echo-2");
  });

  it("keeps an explicit active Setting Profile when the Game Mode seed changes", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => undefined },
    });
    const stored = {
      activeProfileId: "my-setting",
      profiles: {
        "my-setting": {
          id: "my-setting",
          label: "My Setting",
          originRulesFamily: "d6-system-second-edition",
          skills: [],
          version: 2,
        },
      },
      version: 2,
    };

    expect(
      normalizeWorldSettingProfiles(stored, "open-d6-first-edition")
        .activeProfileId,
    ).toBe("my-setting");
  });

  it("moves legacy world terminology into the active Setting Profile once", async () => {
    const stored = new Map<string, unknown>([
      [
        "worldSettingProfiles",
        {
          activeProfileId: "my-setting",
          profiles: {
            "my-setting": {
              id: "my-setting",
              label: "My Setting",
              skills: [],
              version: 2,
            },
          },
          version: 2,
        },
      ],
      [
        "worldTerminologyOverrides",
        {
          attributes: { brawn: "Strength" },
          resources: { heroPoints: "Force Points" },
        },
      ],
    ]);
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: {
        get: (_system: string, key: string) => stored.get(key),
        set: (_system: string, key: string, value: unknown) => {
          stored.set(key, value);
          return Promise.resolve(value);
        },
      },
    });
    vi.stubGlobal("Hooks", { callAll: vi.fn() });

    await expect(migrateLegacyWorldTerminologyOverrides()).resolves.toBe(true);
    const world = normalizeWorldSettingProfiles(
      stored.get("worldSettingProfiles"),
      "d6-system-second-edition",
    );
    expect(world.profiles["my-setting"]?.terminology).toEqual({
      attributes: { brawn: "Strength" },
      resources: { heroPoints: "Force Points" },
    });
    expect(stored.get("worldTerminologyOverrides")).toEqual({});
    await expect(migrateLegacyWorldTerminologyOverrides()).resolves.toBe(false);
  });
});

describe("world Setting Profile lifecycle", () => {
  const stored = new Map<string, unknown>();

  function installWorld(): void {
    stored.clear();
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: {
        get: (_system: string, key: string) => stored.get(key),
        set: (_system: string, key: string, value: unknown) => {
          stored.set(key, value);
          return Promise.resolve(value);
        },
      },
    });
    vi.stubGlobal("Hooks", { callAll: vi.fn() });
  }

  it("takes Attribute activation only from the active Rules Profile workspace", () => {
    installWorld();
    stored.set("secondEditionOptionalTechnical", true);
    stored.set("secondEditionOptionalMechanical", false);
    stored.set("worldSettingProfiles", {
      activeProfileId: "legacy-overlap",
      profiles: {
        "legacy-overlap": {
          attributes: [
            { active: false, id: "technical", label: "Engineering" },
            { active: true, id: "mechanical", label: "Machines" },
          ],
          id: "legacy-overlap",
          label: "Legacy Overlap",
          skills: [],
          version: 2,
        },
      },
      version: 2,
    });

    const active = currentSettingActiveAttributes();
    expect(active.map(({ id }) => id)).toContain("technical");
    expect(active.find(({ id }) => id === "technical")?.label).toBe(
      "Engineering",
    );
    expect(active.map(({ id }) => id)).not.toContain("mechanical");
  });

  it("activates the complete seven-Attribute FreeD6 vocabulary", () => {
    installWorld();
    stored.set("worldRulesProfiles", {
      activeProfileId: "free-d6",
      profiles: {},
      version: 4,
    });
    stored.set("worldSettingProfiles", {
      activeProfileId: "free-d6",
      profiles: {},
      version: 5,
    });

    expect(currentSettingActiveAttributes().map(({ id }) => id)).toEqual([
      "agility",
      "coordination",
      "strength",
      "knowledge",
      "perception",
      "charisma",
      "technical",
    ]);
  });

  it("duplicates profiles with collision-safe ids without activating on save", async () => {
    installWorld();
    const source = normalizeSettingProfile({
      id: "echo",
      label: "Echo",
      skills: [],
    });
    stored.set("worldSettingProfiles", {
      activeProfileId: source.id,
      profiles: { [source.id]: source },
      version: 2,
    });
    const first = duplicateSettingProfile(source);
    expect(first.id).toBe("echo-copy");
    await saveWorldSettingProfile(first);
    expect(
      normalizeWorldSettingProfiles(stored.get("worldSettingProfiles"))
        .activeProfileId,
    ).toBe("echo");
    expect(duplicateSettingProfile(source).id).toBe("echo-copy-2");
  });

  it("creates a row-logo profile independently of the active watermark choice", async () => {
    installWorld();
    const active = normalizeSettingProfile({
      id: "watermarked",
      label: "Watermarked",
      logoAsWatermark: true,
      palette: D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE,
      skills: [],
    });
    stored.set("worldSettingProfiles", {
      activeProfileId: active.id,
      profiles: { [active.id]: active },
      version: 5,
    });

    const created = await createSettingProfile();

    expect(created.logoAsWatermark).toBe(false);
    expect(created.palette).toEqual(D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE);
    expect(
      normalizeWorldSettingProfiles(stored.get("worldSettingProfiles"))
        .profiles[created.id]?.logoAsWatermark,
    ).toBe(false);
  });

  it("creates a coherent profile from a legacy provider logo and resolved palette", async () => {
    installWorld();
    const providerPalette = {
      accent: "#ff9f4a",
      accentBright: "#ffd0a3",
      background: "#080402",
      muted: "#d8c6b8",
      text: "#fff8f3",
    };
    const logo = "modules/example-setting/art/branding/example-mark.webp";
    themeRegistry.register("example-setting", {
      cssClass: "d6e2-theme-example",
      id: "example",
      label: "Example",
      pauseIcon: logo,
      tokens: providerPalette,
    });
    const active = normalizeSettingProfile({
      id: "example-customized",
      label: "Example",
      logo,
      skills: [],
    });
    expect(active.palette).toBeUndefined();
    stored.set("worldSettingProfiles", {
      activeProfileId: active.id,
      profiles: { [active.id]: active },
      version: 5,
    });

    const created = await createSettingProfile();

    expect(created.logo).toBe(logo);
    expect(created.palette).toEqual(providerPalette);
  });

  it("preserves explicit watermark choices through duplicate, save, and export/import", async () => {
    installWorld();
    for (const logoAsWatermark of [true, false]) {
      const source = normalizeSettingProfile({
        id: logoAsWatermark ? "watermark-on" : "watermark-off",
        label: logoAsWatermark ? "Watermark On" : "Watermark Off",
        logoAsWatermark,
        skills: [],
      });
      const duplicate = duplicateSettingProfile(source);
      expect(duplicate.logoAsWatermark).toBe(logoAsWatermark);
      const saved = await saveWorldSettingProfile(duplicate);
      expect(saved.logoAsWatermark).toBe(logoAsWatermark);
      const imported = importSettingProfile(exportSettingProfile(source));
      expect(imported.logoAsWatermark).toBe(logoAsWatermark);
    }
  });

  it("preserves explicit watermark choices while editing the active profile", async () => {
    for (const logoAsWatermark of [true, false]) {
      installWorld();
      const active = normalizeSettingProfile({
        id: logoAsWatermark ? "edit-watermark-on" : "edit-watermark-off",
        label: "Editable",
        logoAsWatermark,
        skills: [],
      });
      stored.set("worldSettingProfiles", {
        activeProfileId: active.id,
        profiles: { [active.id]: active },
        version: 5,
      });

      const saved = await saveCurrentSettingProfile({
        ...active,
        description: "Edited without changing presentation mode.",
      });

      expect(saved.logoAsWatermark).toBe(logoAsWatermark);
      expect(
        normalizeWorldSettingProfiles(stored.get("worldSettingProfiles"))
          .profiles[active.id]?.logoAsWatermark,
      ).toBe(logoAsWatermark);
    }
  });

  it("round-trips a strict portable export without overwriting an id", () => {
    installWorld();
    const source = normalizeSettingProfile({
      id: "table-setting",
      label: "Table Setting",
      palette: D6_SYSTEM_2E_OPEN_D6_SETTING_PALETTE,
      skills: [],
    });
    stored.set("worldSettingProfiles", {
      activeProfileId: source.id,
      profiles: { [source.id]: source },
      version: 2,
    });
    const imported = importSettingProfile(exportSettingProfile(source));
    expect(imported.id).toBe("table-setting-2");
    expect(imported.skills).toEqual(source.skills);
    expect(imported.wildDie).toEqual(source.wildDie);
    expect(imported.palette).toEqual(source.palette);
  });

  it("rejects lossy or malformed imports before storage changes", () => {
    installWorld();
    const before = stored.get("worldSettingProfiles");
    expect(() =>
      importSettingProfile({
        kind: "d6-system-2e.setting-profile",
        profile: { id: "broken", label: "Broken", version: 4 },
        version: 5,
      }),
    ).toThrow("Invalid Setting Profile contract");
    expect(() =>
      importSettingProfile({
        ...exportSettingProfile(
          normalizeSettingProfile({ id: "unsafe", label: "Unsafe" }),
        ),
        profile: {
          ...normalizeSettingProfile({ id: "unsafe", label: "Unsafe" }),
          logo: "https://example.invalid/logo.png",
        },
      }),
    ).toThrow("lossy");
    expect(() =>
      importSettingProfile({
        ...exportSettingProfile(
          normalizeSettingProfile({
            id: "unreadable",
            label: "Unreadable",
            palette: D6_SYSTEM_2E_CLASSIC_SETTING_PALETTE,
          }),
        ),
        profile: {
          ...normalizeSettingProfile({
            id: "unreadable",
            label: "Unreadable",
            palette: D6_SYSTEM_2E_CLASSIC_SETTING_PALETTE,
          }),
          palette: {
            ...D6_SYSTEM_2E_CLASSIC_SETTING_PALETTE,
            text: "#0a0d12",
          },
        },
      }),
    ).toThrow("palette text is invalid");
    expect(stored.get("worldSettingProfiles")).toBe(before);
  });

  it("deletes only inactive world profiles and never changes the active record", async () => {
    installWorld();
    const active = normalizeSettingProfile({ id: "active", label: "Active" });
    const inactive = normalizeSettingProfile({
      id: "inactive",
      label: "Inactive",
    });
    stored.set("worldSettingProfiles", {
      activeProfileId: active.id,
      profiles: { [active.id]: active, [inactive.id]: inactive },
      version: 2,
    });
    await expect(deleteWorldSettingProfile("active")).rejects.toThrow(
      "Active Setting Profile cannot be deleted",
    );
    await expect(deleteWorldSettingProfile("unknown")).rejects.toThrow(
      "Unknown world Setting Profile",
    );
    await deleteWorldSettingProfile("inactive");
    const world = normalizeWorldSettingProfiles(
      stored.get("worldSettingProfiles"),
    );
    expect(world.activeProfileId).toBe("active");
    expect(world.profiles.inactive).toBeUndefined();
    await expect(selectSettingProfile("inactive")).rejects.toThrow("Unknown");
  });

  it("resolves owner-scoped module profiles and preserves unavailable selections", () => {
    installWorld();
    const echo = normalizeSettingProfile({
      id: "echo-d6",
      label: "Echo D6",
      logo: "modules/echo-d6/art/logo.png",
      skills: [],
    });
    registerSettingProfileContribution("echo-d6", echo);
    stored.set("worldSettingProfiles", {
      activeProfileId: "echo-d6",
      profiles: {},
      version: 2,
    });
    expect(
      availableSettingProfiles().find(
        ({ profile }) => profile.id === "echo-d6",
      ),
    ).toMatchObject({ ownerId: "echo-d6", source: "module" });
    expect(currentSettingProfileSelection()).toMatchObject({
      activeProfileId: "echo-d6",
      available: true,
      resolved: { ownerId: "echo-d6", source: "module" },
    });

    resetSettingProfileRegistryForTests();
    expect(currentSettingProfileSelection()).toMatchObject({
      activeProfileId: "echo-d6",
      available: false,
      resolved: {
        ownerId: "d6-system-2e",
        profile: { id: "d6-system-second-edition" },
        source: "bundled",
      },
    });
  });

  it("accepts Echo's complete public Setting Profile without normalization loss", () => {
    installWorld();
    registerSettingProfileContribution(
      "echod6-companion-d6-system-2e",
      createEchoSettingProfile((key) => key),
    );
    expect(
      availableSettingProfiles().find(
        ({ profile }) => profile.id === "echo-d6",
      ),
    ).toMatchObject({
      ownerId: "echod6-companion-d6-system-2e",
      profile: {
        id: "echo-d6",
        terminology: {
          characterSheetLabel: "ECHOD6.CharacterSheet",
          metaphysics: { extranormal: "ECHOD6.Resonance" },
          systemLabel: "ECHOD6.Title",
        },
      },
      source: "module",
    });
  });

  it("rejects cross-owner ids and foreign module assets", () => {
    installWorld();
    const profile = normalizeSettingProfile({
      id: "shared-setting",
      label: "Shared Setting",
      logo: "modules/first-owner/art/logo.png",
    });
    registerSettingProfileContribution("first-owner", profile);
    expect(() =>
      registerSettingProfileContribution("second-owner", {
        ...profile,
        logo: "modules/second-owner/art/logo.png",
      }),
    ).toThrow("already registered");
    expect(() =>
      registerSettingProfileContribution("first-owner", {
        ...profile,
        id: "foreign-assets",
        logo: "modules/second-owner/art/logo.png",
      }),
    ).toThrow("registering owner");
  });

  it("forks immutable profiles before saving edits", async () => {
    installWorld();
    const editable = editableCurrentSettingProfile();
    expect(editable.id).toBe("d6-system-second-edition-customized");
    expect(editable.label).toContain("Customized");
    const saved = await saveCurrentSettingProfile({
      ...defaultSettingProfile("d6-system-second-edition"),
      description: "Table-specific presentation",
    });
    expect(saved.id).toBe("d6-system-second-edition-customized");
    expect(saved.description).toBe("Table-specific presentation");
    expect(currentSettingProfileSelection()).toMatchObject({
      activeProfileId: "d6-system-second-edition-customized",
      available: true,
      resolved: { source: "world" },
    });
  });

  it("removes exact legacy bundled copies without losing the active id", async () => {
    installWorld();
    const bundled = defaultSettingProfile("d6-system-second-edition");
    stored.set("worldSettingProfiles", {
      activeProfileId: bundled.id,
      profiles: { [bundled.id]: bundled },
      version: 2,
    });
    const migrated = await ensureWorldSettingProfilesStored();
    expect(migrated.activeProfileId).toBe("d6-system-second-edition");
    expect(migrated.profiles).toEqual({});
  });
});
