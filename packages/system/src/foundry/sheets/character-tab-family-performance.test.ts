import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEchoRulesProfile } from "../../../../echod6-companion-d6-system-2e/src/rules-profile";

const root = new URL("../../../../../", import.meta.url);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function setup(isGM: boolean) {
  const user = { id: isGM ? "gm" : "player", isGM };
  const values = new Map<string, unknown>([
    ["secondEditionAdvancementStrategy", "experience-points"],
    ["secondEditionWildDieStrategy", "core"],
    ["secondEditionHeroPointStrategy", "heroic"],
  ]);
  const { document, window } = parseHTML("<html><body></body></html>");
  const actor = {
    id: "tab-performance",
    name: "Tab performance sentinel",
    type: "character",
    isOwner: true,
    system: {
      attributes: {},
      resources: {
        characterPoints: { value: 31 },
        experiencePoints: { value: 79 },
        heroPoints: { value: 7 },
        fatePoints: { value: 3 },
      },
      sheetMode: { value: "normal" },
    },
    items: { contents: [], get: () => undefined },
    effects: { contents: [] },
    testUserPermission: () => true,
    getFlag: () => undefined,
    getActiveTokens: () => [],
    update: vi.fn(),
  };
  const nativeRender = vi.fn();
  class NativeSheet {
    actor = actor;
    isEditable = true;
    tabGroups = { primary: "attributes" };
    element = document.createElement("form");
    render(force?: boolean, options?: Record<string, unknown>) {
      nativeRender(force, options);
    }

    _configureRenderOptions(options: { parts?: string[] }) {
      options.parts ??= [
        "header",
        "controls",
        "tabs",
        "attributes",
        "biography",
        "equipment",
        "combat",
      ];
    }

    _onRender(): Promise<void> {
      return Promise.resolve();
    }

    changeTab(
      tab: string,
      group: string,
      {
        navElement,
        force = false,
      }: { navElement?: HTMLElement; force?: boolean } = {},
    ): void {
      if (this.tabGroups.primary === tab && !force) return;
      const controls = navElement
        ? Array.from(navElement.querySelectorAll<HTMLElement>("[data-tab]"))
        : Array.from(
            this.element.querySelectorAll<HTMLElement>(
              `.tabs [data-group="${group}"][data-tab]`,
            ),
          );
      const control = controls.find(({ dataset }) => dataset.tab === tab);
      if (!control) throw new Error(`Missing tab control for ${tab}`);
      for (const candidate of controls)
        candidate.classList.toggle("active", candidate === control);
      const panels: HTMLElement[] = Array.from(
        this.element.querySelectorAll<HTMLElement>(
          `.tab[data-group="${group}"]`,
        ),
      );
      for (const panel of panels)
        panel.classList.toggle("active", panel.dataset.tab === tab);
      this.tabGroups.primary = tab;
    }
  }
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  vi.stubGlobal("foundry", {
    applications: {
      ux: {
        TextEditor: {
          implementation: {
            enrichHTML: (html: string) => Promise.resolve(html),
          },
        },
      },
      api: {
        ApplicationV2: NativeSheet,
        HandlebarsApplicationMixin: (base: unknown) => base,
      },
      sheets: { ActorSheetV2: NativeSheet },
    },
    utils: {
      cleanHTML: (html: string) => html,
      randomID: () => "tab-performance-scope",
    },
  });
  vi.stubGlobal("Hooks", { on: vi.fn(), once: vi.fn(), callAll: vi.fn() });
  vi.stubGlobal("game", {
    user,
    actors: { contents: [actor] },
    users: { contents: [] },
    modules: new Map(),
    system: {
      id: "d6-system-2e",
      api: {
        templates: { current: () => [] },
        features: { read: () => ({}) },
        combat: { read: () => null },
        extraordinaryPowerFrameworkRegistry: { current: () => [] },
      },
    },
    i18n: { localize: (key: string) => key, format: (key: string) => key },
    settings: {
      get: (_scope: string, key: string) => values.get(key),
      set: vi.fn(),
    },
  });
  const library = await import("../../settings/rules-profile-library");
  const echo = createEchoRulesProfile((key) => key);
  const profile = library.normalizeRulesProfile({
    ...echo,
    id: `echo-tab-performance-${user.id}`,
    source: { kind: "world" },
  });
  values.set("worldRulesProfiles", {
    version: 5,
    activeProfileId: profile.id,
    profiles: { [profile.id]: profile },
  });
  const { setRulesProfileTerminology } =
    await import("../../registries/terminology");
  setRulesProfileTerminology(profile.terminology);
  const { D6System2eCharacterSheet } = await import("./character-sheet");
  const sheet = new D6System2eCharacterSheet();
  const context = (await sheet._prepareContext()) as {
    activeTabFamily: { showChildNavigation: boolean };
    tabFamilies: readonly {
      active: boolean;
      cssClass: string;
      icon: string;
      id: string;
      label: string;
      showChildNavigation: boolean;
      tabs: readonly {
        cssClass: string;
        group: string;
        icon: string;
        id: string;
        label: string;
      }[];
    }[];
  };
  const hb = Handlebars.create();
  hb.registerHelper("localize", (key: string) => key);
  sheet.element.innerHTML = hb.compile(
    readFileSync(
      new URL("templates/actor/character/navigation.hbs", root),
      "utf8",
    ),
  )(context);
  for (const family of context.tabFamilies)
    for (const tab of family.tabs) {
      const panel = document.createElement("section");
      panel.className = `tab ${tab.id === "attributes" ? "active" : ""}`;
      panel.dataset.group = "primary";
      panel.dataset.tab = tab.id;
      for (let index = 0; index < 160; index += 1) {
        const row = document.createElement("div");
        row.dataset.row = `${tab.id}-${index}`;
        panel.append(row);
      }
      sheet.element.append(panel);
    }
  const biography = sheet.element.querySelector<HTMLElement>(
    '.tab[data-tab="biography"]',
  );
  if (!biography) throw new Error("Biography tab fixture missing");
  const input = document.createElement("input");
  input.value = "unsaved biography edit";
  const editor = document.createElement("prose-mirror");
  editor.textContent = "live editor state";
  biography.append(input, editor);

  const actions = D6System2eCharacterSheet.DEFAULT_OPTIONS.actions as Record<
    string,
    (event: Event, target: HTMLElement) => void
  >;
  const selectFamily = (family: string) => {
    const target = document.createElement("button");
    target.dataset.tabFamily = family;
    actions.selectTabFamily?.call(sheet, new window.Event("click"), target);
  };
  return {
    context,
    nativeRender,
    editor,
    input,
    selectFamily,
    sheet,
    actor,
    values,
    actions,
  };
}

describe("character tab family navigation performance", () => {
  for (const isGM of [true, false])
    it(`switches a populated ${isGM ? "GM" : "player"} sheet in place`, async () => {
      const { context, editor, input, selectFamily, sheet } = await setup(isGM);
      const prepareContext = vi.spyOn(sheet, "_prepareContext");
      const render = vi.spyOn(sheet, "render");
      const biography = sheet.element.querySelector(
        '.tab[data-tab="biography"]',
      );
      expect(
        sheet.element.querySelectorAll("[data-row]").length,
      ).toBeGreaterThan(600);

      selectFamily("profile");

      expect(sheet.tabGroups.primary).toBe("biography");
      expect(render).not.toHaveBeenCalled();
      expect(prepareContext).not.toHaveBeenCalled();
      expect(
        sheet.element.querySelector('.tab[data-tab="biography"].active'),
      ).toBe(biography);
      expect(biography?.querySelector("input")).toBe(input);
      expect(biography?.querySelector("prose-mirror")).toBe(editor);
      expect(input.value).toBe("unsaved biography edit");
      expect(editor.textContent).toBe("live editor state");
      expect(
        sheet.element
          .querySelector('.d6e2-parent-tab[data-tab-family="profile"].active')
          ?.getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        sheet.element.querySelectorAll(
          '.d6e2-child-navigation [data-tab="biography"], .d6e2-child-navigation [data-tab="traits"]',
        ),
      ).toHaveLength(2);

      const profileNavigation = sheet.element.querySelector<HTMLElement>(
        ".d6e2-child-navigation",
      );
      if (!profileNavigation)
        throw new Error("Profile tab navigation fixture missing");
      (
        sheet as unknown as {
          changeTab(
            tab: string,
            group: string,
            options: { navElement?: HTMLElement },
          ): void;
        }
      ).changeTab("traits", "primary", {
        navElement: profileNavigation,
      });
      selectFamily("gear");
      expect(sheet.tabGroups.primary).toBe("equipment");
      expect(sheet.element.querySelector(".d6e2-child-navigation")).toBeNull();
      selectFamily("profile");
      expect(sheet.tabGroups.primary).toBe("traits");
      expect(render).not.toHaveBeenCalled();
      expect(prepareContext).not.toHaveBeenCalled();

      for (let index = 0; index < 30; index += 1) {
        selectFamily("character");
        selectFamily("gear");
        selectFamily("profile");
      }
      expect(sheet.tabGroups.primary).toBe("traits");
      expect(render).not.toHaveBeenCalled();
      expect(prepareContext).not.toHaveBeenCalled();
      expect(biography?.querySelector("input")).toBe(input);
      expect(biography?.querySelector("prose-mirror")).toBe(editor);
      expect(
        sheet.element.querySelectorAll(".d6e2-child-navigation"),
      ).toHaveLength(1);

      expect(context.tabFamilies.map(({ id }) => id)).toContain("character");
      sheet.render(true);
      expect(render).toHaveBeenCalledOnce();
    });

  it("does nothing when the active family is selected again", async () => {
    const { selectFamily, sheet } = await setup(true);
    selectFamily("profile");
    const navigation = sheet.element.querySelector(".d6e2-child-navigation");
    const render = vi.spyOn(sheet, "render");
    const changeTab = vi.spyOn(
      sheet as unknown as { changeTab: () => void },
      "changeTab",
    );

    selectFamily("profile");

    expect(changeTab).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
    expect(sheet.element.querySelector(".d6e2-child-navigation")).toBe(
      navigation,
    );
  });

  it("falls back to a full render when the rendered tab DOM is incomplete", async () => {
    const { selectFamily, sheet } = await setup(true);
    sheet.element.querySelector('.tab[data-tab="equipment"]')?.remove();
    const render = vi.spyOn(sheet, "render");

    selectFamily("gear");

    expect(sheet.tabGroups.primary).toBe("equipment");
    expect(render).toHaveBeenCalledOnce();
  });

  it("reconciles a document render prepared before the latest tab click", async () => {
    const { context, selectFamily, sheet } = await setup(true);
    const staleHTML = sheet.element.innerHTML;
    selectFamily("profile");
    expect(sheet.tabGroups.primary).toBe("biography");

    // A previously started document refresh finishes with its older selection.
    sheet.element.innerHTML = staleHTML;
    const render = vi.spyOn(sheet, "render");
    await sheet._onRender(context, {});

    expect(
      sheet.element.querySelector('.tab.active[data-tab="biography"]'),
    ).not.toBeNull();
    expect(
      sheet.element
        .querySelector(".d6e2-parent-tab.active")
        ?.getAttribute("data-tab-family"),
    ).toBe("profile");
    expect(render).not.toHaveBeenCalled();

    // A stale DOM must not turn a repeated click into a permanently stuck tab.
    sheet.element.innerHTML = staleHTML;
    selectFamily("profile");
    expect(
      sheet.element.querySelector('.tab.active[data-tab="biography"]'),
    ).not.toBeNull();
    expect(render).not.toHaveBeenCalled();
  });
});

it("lets the native document update render a wound click without requesting another full render", async () => {
  const { sheet, actor, values, actions } = await setup(true);
  const render = vi.spyOn(sheet, "render");
  values.set("gameMode", "open-d6");
  values.set("worldRulesProfiles", {
    activeProfileId: "open-d6",
    profiles: {},
    version: 1,
  });
  values.set("firstEditionBodyPoints", false);
  Object.assign(actor.system, {
    health: { firstEditionWound: "healthy", firstEditionState: {}, tracks: {} },
    movement: { posture: "standing" },
  });
  const button = document.createElement("button");
  button.dataset.condition = "wounded";
  const action = actions.setCondition as
    ((event: Event, target: HTMLElement) => Promise<void>) | undefined;
  if (!action) throw new Error("missing wound action");
  await action.call(sheet, new Event("click"), button);
  expect(actor.update).toHaveBeenCalledTimes(1);
  expect(render).not.toHaveBeenCalled();
});

describe("character context preparation", () => {
  it("skips hidden plans and refreshes scores and advancement when state changes", async () => {
    const { actor, sheet, values } = await setup(true);
    const skill = {
      id: "shooting",
      name: "Shooting",
      type: "skill",
      system: {
        attributeId: "agility",
        key: "shooting",
        score: 5,
        training: "standard",
      },
    };
    Object.assign(actor.items, {
      contents: [skill],
      get: (id: string) => (id === skill.id ? skill : undefined),
    });
    Object.assign(actor.system.attributes, { agility: { score: 11 } });
    const advancement = await import("../advancement-service");
    const attributePlan = vi.spyOn(advancement, "attributeAdvancementPlan");
    const itemPlan = vi.spyOn(advancement, "itemAdvancementPlan");
    const acquisitionPlan = vi.spyOn(
      advancement,
      "specializationAcquisitionPlan",
    );
    const pips = await import("../../settings/pip-rules");
    const projection = vi.spyOn(pips, "currentPipScoreProjection");
    interface Context {
      attributeColumns: {
        id: string;
        scoreLabel: string;
        advanceCost: number;
        canAdvance: boolean;
        skills: {
          scoreLabel: string;
          bonusLabel: string;
          canAdvance: boolean;
          advanceCost: number;
          rollable: boolean;
        }[];
      }[][];
    }
    const prepare = async () => {
      const context = (await sheet._prepareContext()) as unknown as Context;
      const attribute = context.attributeColumns
        .flat()
        .find(({ id }) => id === "agility");
      if (!attribute) throw new Error("Agility fixture missing");
      return attribute;
    };
    sheet.tabGroups.primary = "combat";
    const normal = await prepare();
    expect(normal.scoreLabel).toBe("3D");
    expect(normal.skills[0]).toMatchObject({
      scoreLabel: "4D",
      bonusLabel: "1D",
      canAdvance: false,
      rollable: true,
    });
    expect(attributePlan).not.toHaveBeenCalled();
    expect(itemPlan).not.toHaveBeenCalled();
    expect(acquisitionPlan).not.toHaveBeenCalled();
    expect(projection).toHaveBeenCalledOnce();

    values.set("secondEditionPipsModule", true);
    const pipsEnabled = await prepare();
    expect(pipsEnabled.scoreLabel).toBe("3D+2");
    expect(pipsEnabled.skills[0]).toMatchObject({
      scoreLabel: "5D+1",
      bonusLabel: "1D+2",
    });
    actor.system.sheetMode.value = "advance";
    const advanced = await prepare();
    expect(attributePlan).toHaveBeenCalled();
    expect(itemPlan).toHaveBeenCalledOnce();
    expect(acquisitionPlan).toHaveBeenCalledOnce();
    expect(advanced.advanceCost).toBeGreaterThan(0);
    expect(advanced.skills[0]?.advanceCost).toBeGreaterThan(0);
    expect(advanced.skills[0]?.canAdvance).toBe(true);
    actor.system.resources.experiencePoints.value = 0;
    expect((await prepare()).skills[0]?.canAdvance).toBe(false);
  });

  it("refreshes health labels and header fields from each render's setting profile", async () => {
    const { sheet } = await setup(true);
    const settings = await import("../../settings/setting-profile");
    const original = settings.currentSettingProfile();
    const profile = {
      ...original,
      label: "Test setting",
      logo: "icons/svg/book.svg",
      logoAsWatermark: true,
      healthLabels: {
        ...original.healthLabels,
        "d6e2.health.condition-track": {
          track: "Test track",
          states: { healthy: "Test healthy" },
        },
      },
    };
    const resolveProfile = vi
      .spyOn(settings, "currentSettingProfile")
      .mockReturnValue(profile);
    interface Context {
      settingLabel: string;
      settingLogo: string;
      settingLogoAsWatermark: boolean;
      settingLogoClass: string;
      combat: {
        conditionLabel: string;
        conditionTrackLabel: string;
        conditions: { value: string; label: string }[];
      };
    }
    const first = (await sheet._prepareContext()) as unknown as Context;
    expect(first).toMatchObject({
      settingLabel: "Test setting",
      settingLogo: "icons/svg/book.svg",
      settingLogoAsWatermark: true,
      settingLogoClass: "is-watermark",
    });
    expect(first.combat).toMatchObject({
      conditionLabel: "Test healthy",
      conditionTrackLabel: "Test track",
    });
    expect(
      first.combat.conditions.find(({ value }) => value === "healthy")?.label,
    ).toBe("Test healthy");
    resolveProfile.mockReturnValue({
      ...profile,
      label: "Changed setting",
      logo: "icons/svg/d20.svg",
      logoAsWatermark: false,
      healthLabels: {
        ...profile.healthLabels,
        "d6e2.health.condition-track": {
          track: "Changed track",
          states: { healthy: "Changed healthy" },
        },
      },
    });
    const next = (await sheet._prepareContext()) as unknown as Context;
    expect(next).toMatchObject({
      settingLabel: "Changed setting",
      settingLogo: "icons/svg/d20.svg",
      settingLogoAsWatermark: false,
      settingLogoClass: "is-row-logo",
    });
    expect(next.combat).toMatchObject({
      conditionLabel: "Changed healthy",
      conditionTrackLabel: "Changed track",
    });
    expect(
      next.combat.conditions.find(({ value }) => value === "healthy")?.label,
    ).toBe("Changed healthy");
  });

  it("counts current template catalogs without preparing unused previews", async () => {
    const { sheet } = await setup(true);
    const preview = vi.fn();
    const current = vi.fn(() => [
      { templates: [{ id: "one" }, { id: "two" }] },
    ]);
    Object.assign(game.system.api ?? {}, {
      templates: { current },
      characterTemplates: { preview },
    });
    interface Context {
      characterTemplate: { availableCount: number; canApply: boolean };
    }
    const populated = (await sheet._prepareContext()) as unknown as Context;
    expect(populated.characterTemplate).toMatchObject({
      availableCount: 2,
      canApply: true,
    });
    expect(preview).not.toHaveBeenCalled();
    current.mockReturnValue([]);
    const empty = (await sheet._prepareContext()) as unknown as Context;
    expect(empty.characterTemplate).toMatchObject({
      availableCount: 0,
      canApply: false,
    });
    expect(preview).not.toHaveBeenCalled();
  });
});

it("forwards native update options and skips unrelated async reads for health-only parts", async () => {
  const { sheet, nativeRender, actor } = await setup(true);
  const options = {
    isFirstRender: false,
    renderContext: "updateActor",
    renderData: { "system.health.firstEditionWound": "wounded" },
    parts: [] as string[],
  };
  sheet.render(false, options);
  expect(nativeRender).toHaveBeenCalledWith(false, options);
  options.parts = [
    "header",
    "controls",
    "tabs",
    "biography",
    "equipment",
    "combat",
  ];
  sheet._configureRenderOptions(options);
  expect(options.parts).toEqual(["header", "combat"]);
  const storage = await import("../grid-storage-sheet-integration");
  const storageRead = vi.spyOn(storage, "gridStorageActorSheetContext");
  const writing = await import("./character-writing-editor");
  const writingRead = vi.spyOn(writing, "enrichCharacterWritingFields");
  Object.assign(actor.system, { health: { condition: "wounded" } });
  const context = await sheet._prepareContext(options);
  expect(context.combat).toBeDefined();
  expect(storageRead).not.toHaveBeenCalled();
  expect(writingRead).not.toHaveBeenCalled();
  await sheet._prepareContext();
  expect(storageRead).toHaveBeenCalledOnce();
  expect(writingRead).toHaveBeenCalledOnce();
});
