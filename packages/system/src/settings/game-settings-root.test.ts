import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("../constants", () => ({ SYSTEM_ID: "d6-system-2e" }));
vi.mock("./settings-application", () => ({
  D6System2eFirstEditionSettings: vi.fn(),
  D6System2eSecondEditionSettings: vi.fn(),
}));
vi.mock("./setting-profile-application", () => ({
  D6System2eSettingProfileApplication: vi.fn(),
}));
vi.mock("./setting-profile", () => ({
  currentSettingProfile: () => ({ id: "classic", logo: "classic.png" }),
}));
vi.mock("../foundry/setting-profile-storage", () => ({}));
vi.mock("../foundry/setting-profile-service", () => ({}));
vi.mock("./rules-profile-application", () => ({
  D6System2eRulesProfileApplication: vi.fn(),
}));
vi.mock("./rules-profile-library", () => ({}));
vi.mock("../registries/profile-presets", () => ({}));
vi.mock("../foundry/profile-preset-service", () => ({}));
vi.mock("./settings-catalog", () => ({
  SHARED_SETTING_KEYS: { userTheme: "userTheme" },
}));
vi.mock("./presentation-theme", () => ({
  resolvePersonalThemeSelection: (
    themes: readonly unknown[],
    _profile: unknown,
    requestedId: string,
  ) => ({
    available: true,
    effectiveTheme: themes[0],
    inherits: requestedId === "inherit",
    requestedId,
  }),
  resolveSettingLogo: (value: string) => value,
}));
vi.mock("../registries/themes", () => ({
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
  tabIndex = 0;
  textContent = "";
  type = "";
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

  replaceChildren(...children: RenderedElement[]): void {
    this.children.splice(0, this.children.length, ...children);
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
    expect(implementation).toContain("D6System2eRulesProfileApplication");
    expect(implementation).toContain("createWorldRulesProfile()");
    expect(implementation).toContain("withDraft(draft, { isNew })");
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
    expect(implementation).toContain("rulesProfileSettingsWorkspace(");
    expect(implementation).toContain("currentConfiguredRulesProfile())");
    expect(implementation).not.toContain("currentGameMode");
    expect(implementation).not.toContain("d6e2ConfigureMode");
    expect(implementation).toContain(
      "new D6System2eSecondEditionSettings().render(true)",
    );
    expect(implementation).toContain(
      "new D6System2eFirstEditionSettings().render(true)",
    );
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
        format: (key: string) => key,
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
