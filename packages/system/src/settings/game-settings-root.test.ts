import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import type * as ProfilePresetRegistryModule from "../registries/profile-presets";

const activeProfileSelection = vi.hoisted(() => ({
  rulesProfileId: "open-d6",
  settingProfileId: "open-d6-first-edition",
}));
const configuredRulesProfile = vi.hoisted(() => ({
  id: "open-d6",
  label: "Existing World Rules",
  source: { kind: "world" as const },
  strategies: {},
}));
const rulesProfileEditor = vi.hoisted(() => {
  const instance = {
    render: vi.fn(),
    withDraft: vi.fn(),
  };
  instance.withDraft.mockReturnValue(instance);
  return {
    application: vi.fn(() => instance),
    instance,
  };
});
const editionSettingsEditors = vi.hoisted(() => {
  const firstEdition = { render: vi.fn(), withRulesDraft: vi.fn() };
  const secondEdition = { render: vi.fn(), withRulesDraft: vi.fn() };
  firstEdition.withRulesDraft.mockReturnValue(firstEdition);
  secondEdition.withRulesDraft.mockReturnValue(secondEdition);
  return {
    firstEdition,
    firstEditionApplication: vi.fn(() => firstEdition),
    secondEdition,
    secondEditionApplication: vi.fn(() => secondEdition),
  };
});

vi.mock("../constants", () => ({ SYSTEM_ID: "d6-system-2e" }));
vi.mock("./settings-application", () => ({
  D6System2eFirstEditionSettings:
    editionSettingsEditors.firstEditionApplication,
  D6System2eSecondEditionSettings:
    editionSettingsEditors.secondEditionApplication,
}));
vi.mock("./setting-profile-application", () => ({
  D6System2eSettingProfileApplication: vi.fn(),
}));
vi.mock("./setting-profile", () => ({
  availableSettingProfiles: () => [
    {
      profile: {
        id: "d6-system-second-edition",
        label: "Second Edition",
        logo: "systems/d6-system-2e/assets/ui/d6-pause-mark.svg",
      },
      source: "bundled",
    },
    {
      profile: {
        id: "open-d6-first-edition",
        label: "Open D6",
        logo: "systems/d6-system-2e/assets/ui/open-d6-profile-mark.svg",
      },
      source: "bundled",
    },
    {
      profile: {
        id: "free-d6",
        label: "FreeD6",
        logo: "systems/d6-system-2e/assets/ui/open-d6-profile-mark.svg",
      },
      source: "bundled",
    },
    {
      profile: {
        id: "d6mv",
        label: "D6MV",
        logo: "systems/d6-system-2e/assets/ui/d6-pause-mark.svg",
      },
      source: "bundled",
    },
    {
      profile: {
        id: "contributed",
        label: "Contributed",
        logo: "modules/example/assets/profile.png",
      },
      source: "module",
    },
  ],
  currentSettingProfile: () => ({
    id: "d6-system-second-edition",
    label: "Second Edition",
    logo: "systems/d6-system-2e/assets/ui/d6-pause-mark.svg",
  }),
  currentSettingProfileSelection: () => ({
    activeProfileId: activeProfileSelection.settingProfileId,
  }),
}));
vi.mock("../foundry/setting-profile-storage", () => ({}));
vi.mock("../foundry/setting-profile-service", () => ({}));
vi.mock("./rules-profile-application", () => ({
  D6System2eRulesProfileApplication: rulesProfileEditor.application,
}));
vi.mock("./rules-profile-library", () => ({
  availableRulesProfiles: () => [
    {
      id: "second-edition",
      label: "Second Edition Rules",
      strategies: {},
    },
    {
      id: "open-d6",
      label: "Open D6 Rules",
      matchingEvaluators: [],
      strategies: {},
    },
  ],
  currentConfiguredRulesProfile: () => configuredRulesProfile,
  createWorldRulesProfile: () => ({
    ...configuredRulesProfile,
    id: "new-rules-profile",
    source: { kind: "world" as const },
  }),
  rulesProfileSettingsWorkspace: () => "open-d6",
}));
vi.mock("../registries/profile-presets", async (importOriginal) => {
  const actual = await importOriginal<typeof ProfilePresetRegistryModule>();
  return {
    ...actual,
    availableProfilePresets: () => [
      ...actual.bundledProfilePresets(),
      {
        ownerId: "example",
        preset: {
          id: "preset-gamma",
          label: "Contributed preset",
          description: "Contributed",
          selection: {
            rulesProfileId: "open-d6",
            settingProfileId: "contributed",
            version: 1 as const,
          },
          version: 1 as const,
        },
        source: "module" as const,
      },
    ],
  };
});
vi.mock("../foundry/profile-preset-service", () => ({}));
vi.mock("./settings-catalog", () => ({
  SHARED_SETTING_KEYS: { userTheme: "userTheme" },
}));
vi.mock("../registries/themes", () => ({
  D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON:
    "systems/d6-system-2e/assets/ui/d6-pause-mark.svg",
  themeRegistry: {
    current: () => [
      {
        cssClass: "classic",
        id: "classic",
        label: "Classic",
        tokens: {
          accent: "#444",
          accentBright: "#666",
          background: "#222",
        },
      },
      {
        cssClass: "echo",
        id: "echo",
        label: "Echo",
        tokens: {
          accent: "#844",
          accentBright: "#a66",
          background: "#422",
        },
      },
    ],
  },
}));
vi.mock("./setting-values", () => ({
  stringSetting: () => "inherit",
}));

class RenderedElement {
  readonly addEventListener = vi.fn();
  readonly attributes = new Map<string, string>();
  readonly children: RenderedElement[] = [];
  readonly classList = {
    add: (...values: string[]) => {
      for (const value of values) this.classes.add(value);
    },
    toggle: (value: string, force?: boolean) => {
      const enabled = force ?? !this.classes.has(value);
      if (enabled) this.classes.add(value);
      else this.classes.delete(value);
      return enabled;
    },
  };
  readonly dataset: Record<string, string> = {};
  disabled = false;
  hidden = false;
  selected = false;
  selectedIndex = -1;
  tabIndex = 0;
  textContent = "";
  title = "";
  type = "";
  value = "";
  private readonly classes = new Set<string>();
  readonly style = { setProperty: vi.fn() };

  constructor(
    readonly tagName: string,
    className = "",
  ) {
    this.className = className;
  }

  get className(): string {
    return [...this.classes].join(" ");
  }

  set className(value: string) {
    this.classes.clear();
    for (const name of value.split(/\s+/).filter(Boolean)) {
      this.classes.add(name);
    }
  }

  append(...children: RenderedElement[]): void {
    this.children.push(...children);
  }

  readonly focus = vi.fn();

  prepend(...children: RenderedElement[]): void {
    this.children.unshift(...children);
  }

  querySelector(selector: string): RenderedElement | null {
    return this.find((element) => element.matches(selector));
  }

  querySelectorAll(selector: string): RenderedElement[] {
    return this.findAll((element) => element.matches(selector));
  }

  closest(selector: string): RenderedElement | null {
    return this.matches(selector) ? this : null;
  }

  replaceChildren(...children: RenderedElement[]): void {
    this.children.splice(0, this.children.length, ...children);
    if (this.tagName === "select") {
      const selectedIndex = children.findIndex((child) => child.selected);
      this.selectedIndex = selectedIndex;
      this.value =
        selectedIndex >= 0 ? (children[selectedIndex]?.value ?? "") : "";
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  private find(
    predicate: (element: RenderedElement) => boolean,
  ): RenderedElement | null {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const nested = child.find(predicate);
      if (nested) return nested;
    }
    return null;
  }

  private findAll(
    predicate: (element: RenderedElement) => boolean,
  ): RenderedElement[] {
    return this.children.flatMap((child) => [
      ...(predicate(child) ? [child] : []),
      ...child.findAll(predicate),
    ]);
  }

  private matches(selector: string): boolean {
    if (selector.startsWith(".")) return this.classes.has(selector.slice(1));
    if (selector === "h3") return this.tagName === "h3";
    const dataAttribute = /^\[data-([a-z0-9-]+)\]$/.exec(selector)?.[1];
    if (!dataAttribute) return false;
    const key = dataAttribute.replace(/-([a-z])/g, (_match, letter: string) =>
      letter.toUpperCase(),
    );
    return key in this.dataset;
  }
}

const implementation = readFileSync(
  new URL("./game-settings-root.ts", import.meta.url),
  "utf8",
);
const registration = readFileSync(
  new URL("./system-settings.ts", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);
const rulesProfileTemplate = readFileSync(
  new URL("../../../../templates/settings/rules-profile.hbs", import.meta.url),
  "utf8",
);

describe("root Game Settings system mode", () => {
  it("enhances Foundry's native SettingsConfig system category", () => {
    expect(implementation).toContain('Hooks.on("renderSettingsConfig"');
    expect(implementation).toContain('[data-category="system"]');
    expect(implementation).toContain(
      "category.prepend(rootSetup, personalTheme)",
    );
    expect(implementation).toContain("buildSettingProfileSetup(category)");
    expect(implementation).toContain("buildProfilePresetSetup(category)");
    expect(implementation).toContain("availableProfilePresets()");
    expect(implementation).toContain("previewProfilePreset(");
    expect(implementation).toContain("confirmProfilePresetActivation(");
    expect(implementation).toContain("activateProfilePreset(");
    expect(implementation).toContain("data-d6e2-profile-preset");
    expect(implementation).toContain("data-d6e2-apply-profile-preset");
    expect(implementation).toContain("position: { width: 520 }");
    expect(implementation).toContain("const requestedProfileId = select.value");
    expect(implementation).toContain(
      "activateSettingProfile(requestedProfileId)",
    );
    expect(implementation).toContain("availableSettingProfiles()");
    expect(implementation).toContain("currentSettingProfileSelection()");
    expect(implementation).toContain("UnavailableSelection");
    expect(implementation).not.toContain("openSettingProfileTerminologyEditor");
    expect(implementation).not.toContain('if (action === "terminology")');
    for (const action of ["duplicate", "import", "export", "delete"]) {
      expect(implementation).toContain(`action === "${action}"`);
    }
    expect(implementation).toContain("importSettingProfile(value)");
    expect(implementation).toContain("settingProfileAssetDiagnostics(profile)");
    expect(implementation).toContain("promptSettingProfileDeletion()");
    expect(implementation).toContain(
      ".filter(({ id }) => id !== world.activeProfileId)",
    );
    expect(implementation).toContain("removeNativeEditionMenuRows(category)");
    expect(implementation).toContain('?.closest<HTMLElement>(".form-group")');
    expect(implementation).toContain("?.remove()");
  });

  it("uses an explicit Rules Profile selector and in-card configuration", () => {
    expect(implementation).toContain("select.dataset.d6e2RulesProfile");
    expect(implementation).toContain("availableRulesProfiles().map");
    expect(implementation).toContain("selectRulesProfile(requested)");
    expect(implementation).toContain("createWorldRulesProfile()");
    expect(implementation).toContain(".withRulesDraft(draft, { isNew: true })");
    expect(implementation).toContain('"[data-d6e2-configure-active-rules]"');
    expect(implementation).toContain(
      'localized("D6E2.Settings.RulesProfile.ConfigureActive")',
    );
    expect(implementation).not.toContain(
      'localized("D6E2.Settings.RulesProfile.EditDefinition")',
    );
    expect(implementation).toContain(
      'const createIcon = element("i", "fa-solid fa-plus")',
    );
    expect(implementation).toContain('["edit", "Edit", "fa-sliders"]');
    expect(implementation).not.toContain("currentGameMode");
    expect(implementation).not.toContain("d6e2ConfigureMode");
    expect(implementation).toContain("D6System2eSecondEditionSettings");
    expect(implementation).toContain("D6System2eFirstEditionSettings");
    expect(registration).toContain("D6System2eSecondEditionSettings");
    expect(registration).toContain("D6System2eFirstEditionSettings");
  });

  it("opens Create New in the same edition-aware surface", async () => {
    editionSettingsEditors.firstEditionApplication.mockClear();
    editionSettingsEditors.firstEdition.withRulesDraft.mockClear();
    editionSettingsEditors.firstEdition.render.mockClear();
    vi.stubGlobal("document", {
      createElement: (tagName: string) => new RenderedElement(tagName),
    });
    vi.stubGlobal("game", {
      i18n: {
        format: (key: string) => key,
        localize: (key: string) => key,
      },
    });

    const { buildSystemModeSetup } = await import("./game-settings-root");
    const category = new RenderedElement("section");
    const setup = buildSystemModeSetup(
      category as unknown as HTMLElement,
    ) as unknown as RenderedElement;
    const create = setup
      .querySelectorAll("[data-d6e2-rules-profile-action]")
      .find(({ dataset }) => dataset.d6e2RulesProfileAction === "create");
    const click = setup.addEventListener.mock.calls.find(
      ([type]) => type === "click",
    )?.[1] as EventListener | undefined;

    expect(create).not.toBeNull();
    click?.({ target: create } as unknown as Event);
    expect(
      editionSettingsEditors.firstEdition.withRulesDraft,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ id: "new-rules-profile" }),
      {
        isNew: true,
      },
    );
    expect(editionSettingsEditors.firstEdition.render).toHaveBeenCalledWith(
      true,
    );
    expect(rulesProfileEditor.application).not.toHaveBeenCalled();
  });

  it("opens the complete edition-aware settings surface from Configure", async () => {
    editionSettingsEditors.firstEditionApplication.mockClear();
    editionSettingsEditors.firstEdition.render.mockClear();
    vi.stubGlobal("document", {
      createElement: (tagName: string) => new RenderedElement(tagName),
    });
    vi.stubGlobal("game", {
      i18n: {
        format: (key: string) => key,
        localize: (key: string) => key,
      },
    });

    const { buildSystemModeSetup } = await import("./game-settings-root");
    const category = new RenderedElement("section");
    const setup = buildSystemModeSetup(
      category as unknown as HTMLElement,
    ) as unknown as RenderedElement;
    const configure = setup.querySelector("[data-d6e2-configure-active-rules]");
    const click = setup.addEventListener.mock.calls.find(
      ([type]) => type === "click",
    )?.[1] as EventListener | undefined;

    expect(configure).not.toBeNull();
    expect(click).toBeTypeOf("function");
    click?.({ target: configure } as unknown as Event);

    expect(
      editionSettingsEditors.firstEditionApplication,
    ).toHaveBeenCalledOnce();
    expect(editionSettingsEditors.firstEdition.render).toHaveBeenCalledWith(
      true,
    );
    expect(rulesProfileEditor.application).not.toHaveBeenCalled();
    expect(rulesProfileTemplate).not.toContain(
      'data-rules-profile-tab="resolution"',
    );
    expect(rulesProfileTemplate).not.toContain(
      'name="strategy.rollResolution"',
    );
    expect(rulesProfileTemplate).not.toContain("d6e2-roll-resolution-card");
    expect(rulesProfileTemplate).not.toContain("matchingRewards");
  });

  it("updates the open settings category after selecting a Rules Profile", () => {
    expect(implementation).toContain(
      ".finally(() => updateSystemModeSetup(category))",
    );
    expect(implementation).toContain(
      'Hooks.on("d6e2RulesProfileChanged", synchronizeGameSettingsRoot)',
    );
    expect(registration).toContain("WORLD_RULES_PROFILES_SETTING");
  });

  it("keeps edition-owned rules out of the raw root list", () => {
    expect(registration).toContain("registerDefinition(definition, false)");
    expect(registration).not.toContain("registerRulesCompatibilitySettings");
    expect(registration).not.toContain("registerGameModeSetting");
  });

  it("presents profile choices as theme-aware plates, tiles, and menus", () => {
    expect(implementation).toContain("buildProfilePlate(");
    expect(implementation).toContain("buildManageMenu(");
    expect(implementation).toContain("data-d6e2-profile-preset-choice");
    expect(implementation).toContain('button.setAttribute("aria-pressed"');
    expect(implementation).toContain("replaceProfileBadges(");
    expect(styles).toContain(".d6e2-profile-plate");
    expect(styles).toContain(".d6e2-profile-preset-tile.is-selected");
    expect(styles).toContain(".d6e2-profile-manage-menu");
    expect(styles).toContain(".d6e2-profile-badge.is-customized");
    expect(styles).toContain(".d6e2-game-mode-configure-actions");
    expect(styles).toContain(".d6e2-game-mode-configure:disabled");
    expect(styles).toContain("opacity: 0.48");
    expect(styles).toMatch(
      /\.d6e2-system-mode-setup\s*\{[^}]*grid-template-columns:\s*repeat\(\s*auto-fit,/s,
    );
    expect(styles).toMatch(
      /\.d6e2-profile-preset-block\s*\{[^}]*grid-column:\s*1 \/ -1/s,
    );
    expect(styles).toMatch(
      /\.d6e2-profile-preset-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-profile-preset-choices\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,[^}]*max-height:\s*244px;[^}]*overflow-y:\s*auto/s,
    );
    expect(implementation).toContain("button.title = preset.label");
    expect(implementation).toContain("d6e2-profile-logo-mark");
    expect(implementation).toContain("resolveSettingLogoPresentation(");
    expect(styles).toMatch(
      /\.d6e2-profile-logo-mark\[data-branding="mask"\][\s\S]*?background-color:\s*var\(--d6e2-setting-logo-color, var\(--od6-accent\)\);[\s\S]*?mask:\s*var\(--d6e2-profile-logo-image\)/s,
    );
    expect(implementation).toContain("applySettingProfileLogoPresentation(");
  });

  it("groups currency and equipment as separate compact transaction choices", () => {
    expect(implementation).toContain("groupCharacterTransactionSettings(");
    expect(implementation).toContain(
      "SHARED_SETTING_KEYS.characterCurrencyTransactions",
    );
    expect(implementation).toContain(
      "SHARED_SETTING_KEYS.characterEquipmentTransfers",
    );
    expect(styles).toContain(".d6e2-character-transaction-settings");
    expect(styles).toMatch(
      /\.d6e2-character-transaction-choices\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s,
    );
  });

  it("provides an immediate client-only Personal Theme workspace for every user", () => {
    expect(implementation).toContain("buildPersonalThemeSetup(");
    expect(implementation).toContain("updatePersonalThemeSetup(");
    expect(implementation).toContain("data-d6e2-personal-theme");
    expect(implementation).toContain("data-d6e2-personal-theme-choice");
    expect(implementation).toContain('setAttribute("role", "radiogroup")');
    expect(implementation).toContain('setAttribute("aria-checked"');
    expect(implementation).toContain("SHARED_SETTING_KEYS.userTheme");
    expect(implementation).toMatch(/game\.settings\s*\.set\(/s);
    expect(implementation).toContain("d6e2ThemesChanged");
    expect(implementation).toContain("UnavailablePersonalTheme");
    for (const key of [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ]) {
      expect(implementation).toContain(`"${key}"`);
    }
    expect(implementation).toContain("game.user?.isGM !== true");
    expect(implementation).toContain("category.prepend(personalTheme)");
    expect(styles).toContain(".d6e2-personal-theme-settings");
    expect(styles).toContain(".d6e2-personal-theme-choice");
    expect(styles).toMatch(
      /\.d6e2-personal-theme-choice\s*\{[^}]*grid-template-columns:\s*60px minmax\(0, 1fr\) 20px;[^}]*min-height:\s*60px;[^}]*padding:\s*10px 12px/s,
    );
    expect(styles).toMatch(
      /\.d6e2-personal-theme-choices\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,/s,
    );
    expect(styles).toMatch(
      /\.d6e2-personal-theme-palette\s*\{[^}]*align-self:\s*center;[^}]*height:\s*32px/s,
    );
    expect(styles).toMatch(
      /\.d6e2-personal-theme-choice-copy\s*\{[^}]*align-content:\s*center;[^}]*line-height:\s*1\.25;[^}]*overflow-wrap:\s*anywhere/s,
    );
    expect(styles).toMatch(
      /\.d6e2-personal-theme-choice\s*> \.fa-circle-check\s*\{[^}]*align-self:\s*center;[^}]*justify-self:\s*end/s,
    );
    expect(styles).toMatch(
      /\.d6e2-personal-theme-settings\s*\{[^}]*container-name:\s*d6e2-personal-themes;[^}]*container-type:\s*inline-size/s,
    );
    expect(styles).toMatch(
      /@container d6e2-personal-themes \(max-width: 520px\)[\s\S]*\.d6e2-personal-theme-choices\s*\{[^}]*grid-template-columns:\s*1fr/s,
    );
  });

  it("populates Personal Theme choices while the constructed section is detached", async () => {
    const category = new RenderedElement("section");
    vi.stubGlobal("document", {
      createElement: (tagName: string) => new RenderedElement(tagName),
    });
    vi.stubGlobal("game", {
      i18n: {
        format: (key: string, data?: Record<string, unknown>) =>
          typeof data?.resolution === "string"
            ? `${key}:${data.resolution}`
            : key,
        localize: (key: string) => key,
      },
    });

    const { buildPersonalThemeSetup } = await import("./game-settings-root");
    const setup = buildPersonalThemeSetup(
      category as unknown as HTMLElement,
    ) as unknown as RenderedElement;
    const choices = setup.querySelector(".d6e2-personal-theme-choices");

    expect(category.querySelector("[data-d6e2-personal-theme]")).toBeNull();
    expect(choices?.attributes.get("role")).toBe("radiogroup");
    expect(
      choices?.querySelectorAll("[data-d6e2-personal-theme-choice]"),
    ).toHaveLength(3);

    category.prepend(setup);
    expect(
      category.querySelectorAll("[data-d6e2-personal-theme-choice]"),
    ).toHaveLength(3);
  });

  it("renders Campaign Setup preset logos through the shared profile-brand contract", async () => {
    const category = new RenderedElement("section");
    const root = new RenderedElement("section");
    root.dataset.d6e2SystemModeSetup = "";
    category.append(root);
    vi.stubGlobal("document", {
      createElement: (tagName: string) => new RenderedElement(tagName),
    });
    vi.stubGlobal("game", {
      i18n: {
        format: (key: string, data?: Record<string, unknown>) =>
          typeof data?.resolution === "string"
            ? `${key}:${data.resolution}`
            : key,
        localize: (key: string) => key,
      },
    });
    vi.stubGlobal("foundry", {
      utils: { getRoute: (path: string) => `/dev/${path}` },
    });

    const { buildProfilePresetSetup, updateProfilePresetSetup } =
      await import("./game-settings-root");
    root.append(
      buildProfilePresetSetup(
        category as unknown as HTMLElement,
      ) as unknown as RenderedElement,
    );
    updateProfilePresetSetup(category as unknown as HTMLElement);

    const tiles = root.querySelectorAll(".d6e2-profile-preset-tile");
    expect(tiles).toHaveLength(5);
    const logos = tiles.map((tile) =>
      tile.querySelector(".d6e2-profile-logo-mark"),
    );
    expect(logos.every(Boolean)).toBe(true);
    expect(logos.map((logo) => logo?.dataset.branding)).toEqual([
      "mask",
      "mask",
      "mask",
      "mask",
      "image",
    ]);
    expect(logos.map((logo) => logo?.dataset.brand)).toEqual([
      "d6-system",
      "open-d6",
      "d6-system",
      "open-d6",
      "image",
    ]);
    expect(logos[1]?.style.setProperty).toHaveBeenCalledWith(
      "--d6e2-profile-logo-image",
      'url("/dev/systems/d6-system-2e/assets/ui/open-d6-profile-mark.svg")',
    );
    expect(logos[3]?.style.setProperty).toHaveBeenCalledWith(
      "--d6e2-profile-logo-image",
      'url("/dev/systems/d6-system-2e/assets/ui/open-d6-profile-mark.svg")',
    );
    expect(logos[4]?.style.setProperty).toHaveBeenCalledWith(
      "--d6e2-profile-logo-image",
      'url("/dev/modules/example/assets/profile.png")',
    );
    expect(root.querySelectorAll(".fa-layer-group")).toHaveLength(0);
    const openD6Tile = tiles.find(
      ({ dataset }) => dataset.d6e2ProfilePresetChoice === "open-d6-default",
    );
    expect(openD6Tile?.attributes.get("aria-pressed")).toBe("true");
    expect(styles).toMatch(
      /\.d6e2-profile-preset-mark\s*>\s*\.d6e2-profile-logo-mark\s*\{[^}]*width:\s*18px;[^}]*height:\s*18px;/s,
    );
  });

  it("lays out D6 checkboxes and separates every adjacent ordinary D6 setting", () => {
    const ownedCheckboxRow =
      '> .form-group:has(input[type="checkbox"][name^="d6-system-2e."])';
    const ordinaryControl =
      ':is(input, select, textarea)[name^="d6-system-2e."]';

    expect(styles).toContain('[data-category="system"]');
    expect(styles).toContain(ownedCheckboxRow);
    expect(styles).toMatch(
      /\.form-group:has\(input\[type="checkbox"\]\[name\^="d6-system-2e\."\]\)\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) max-content;[^}]*grid-template-areas:\s*"label control"\s*"hint control";/s,
    );
    expect(styles).toMatch(
      /\.form-group:has\(input\[type="checkbox"\]\[name\^="d6-system-2e\."\]\)\s*> \.form-fields\s*\{[^}]*grid-area:\s*control;[^}]*justify-self:\s*end;[^}]*width:\s*max-content;/s,
    );
    expect(styles).toMatch(
      /\.form-group:has\(input\[type="checkbox"\]\[name\^="d6-system-2e\."\]\)\s*> :is\(\.hint, \.notes\)\s*\{[^}]*grid-area:\s*hint;[^}]*min-width:\s*0;/s,
    );
    expect(styles.split(ordinaryControl)).toHaveLength(4);
    expect(styles).toMatch(
      /\.form-group:has\(\s*:is\(input, select, textarea\)\[name\^="d6-system-2e\."\]\s*\)\s*\{[^}]*position:\s*relative;[^}]*padding-block:\s*18px;/s,
    );
    expect(styles).toMatch(
      /\.form-group:has\(input\[type="checkbox"\]\[name\^="d6-system-2e\."\]\)\s*\{[^}]*padding:\s*18px 0;/s,
    );
    expect(styles).toMatch(
      /\+ \.form-group:has\(\s*:is\(input, select, textarea\)\[name\^="d6-system-2e\."\]\s*\)::before\s*\{[^}]*left:\s*50%;[^}]*border-top:\s*1px solid var\(--od6-line\);[^}]*content:\s*"";[^}]*pointer-events:\s*none;/s,
    );
    expect(styles).not.toContain(
      '[data-category="system"] > .form-group:has(:is(input, select, textarea))',
    );
  });
});
