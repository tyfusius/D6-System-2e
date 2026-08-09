import { afterEach, describe, expect, it, vi } from "vitest";
import { createEchoSettingProfile } from "../../../echod6-companion-d6-system-2e/src/setting-profile";
import { firstEditionGenreProfileRegistry } from "../registries/first-edition-genre-profiles";
import {
  deleteWorldSettingProfile,
  availableSettingProfiles,
  currentSettingProfileSelection,
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
} from "./setting-profile";

afterEach(() => {
  resetSettingProfileRegistryForTests();
  firstEditionGenreProfileRegistry.unregisterOwner("open-d6-adventure-test");
  vi.unstubAllGlobals();
});

describe("world Setting Profile contract", () => {
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
      profile: { label: "Open D6 Adventure" },
      source: "module",
    });
    expect(
      resolved?.profile.attributes
        .filter(({ active }) => active)
        .map(({ id }) => id),
    ).toEqual([
      "knowledge",
      "perception",
      "coordination",
      "physique",
      "presence",
      "reflexes",
    ]);
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
          resources: { heroPoints: "Force Points" },
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
      active: true,
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
      resources: { heroPoints: "Force Points" },
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

    expect(profile.logo).toContain("d6-pause-cube.png");
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

    expect(world.version).toBe(2);
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

  it("round-trips a strict portable export without overwriting an id", () => {
    installWorld();
    const source = normalizeSettingProfile({
      id: "table-setting",
      label: "Table Setting",
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
  });

  it("rejects lossy or malformed imports before storage changes", () => {
    installWorld();
    const before = stored.get("worldSettingProfiles");
    expect(() =>
      importSettingProfile({
        kind: "d6-system-2e.setting-profile",
        profile: { id: "broken", label: "Broken", version: 2 },
        version: 2,
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
