import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { D6RulesProfileV7 } from "@d6-system-2e/core";

vi.mock("./health-model-library-application", () => ({
  D6System2eHealthModelLibraryApplication: vi.fn(),
}));
vi.mock("./matching-evaluator-application", () => ({
  D6System2eMatchingEvaluatorApplication: vi.fn(),
}));
vi.mock("../foundry/hero-point-service", () => ({
  refreshHeroicHeroPointsForNewSession: () => Promise.resolve(),
}));

async function setup(
  kind: "normal" | "advanced" | "first",
  loadedProfile?: D6RulesProfileV7,
) {
  vi.resetModules();
  const { window, document } = parseHTML("<html><body></body></html>");
  let focused: HTMLElement = document.body;
  Object.defineProperty(document, "activeElement", {
    configurable: true,
    get: () => focused,
  });
  const focusElement = (element: HTMLElement) => {
    focused = element;
  };
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true,
    value: function (this: HTMLElement) {
      focusElement(this);
    },
  });
  const values = new Map<string, unknown>();
  let sequence = 0;
  const user = { id: "gm", isGM: true };
  const actors: unknown[] = [];
  const hooks = { callAll: vi.fn(), on: vi.fn(), once: vi.fn() };
  vi.stubGlobal("Hooks", hooks);
  vi.stubGlobal("game", {
    user,
    actors: { contents: actors },
    modules: new Map(),
    system: { id: "d6-system-2e" },
    i18n: { localize: (key: string) => key, format: (key: string) => key },
    settings: {
      get: (_s: string, key: string) => values.get(key),
      set: vi.fn((_s: string, key: string, value: unknown) => {
        values.set(key, structuredClone(value));
        return Promise.resolve(value);
      }),
    },
  });
  vi.stubGlobal("ui", {
    notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  for (const name of [
    "HTMLElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLSelectElement",
    "HTMLButtonElement",
    "HTMLFormElement",
    "Element",
  ] as const)
    vi.stubGlobal(name, window[name]);
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get: function (this: HTMLSelectElement) {
      return (
        this.querySelector("option[selected]")?.getAttribute("value") ??
        this.querySelector("option")?.getAttribute("value") ??
        ""
      );
    },
    set: function (this: HTMLSelectElement, value: string) {
      for (const o of Array.from(this.querySelectorAll("option"))) {
        if (o.getAttribute("value") === value) o.setAttribute("selected", "");
        else o.removeAttribute("selected");
      }
    },
  });
  class NativeFormData {
    data: [string, string][];
    constructor(form: HTMLFormElement) {
      this.data = Array.from(
        form.querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("[name]"),
      )
        .filter(
          (i) =>
            !(
              i instanceof window.HTMLInputElement &&
              ["checkbox", "radio"].includes(i.type) &&
              !i.checked
            ),
        )
        .map((i) => [i.name, i.value]);
    }
    getAll(name: string) {
      return this.data
        .filter(([key]) => key === name)
        .map(([, value]) => value);
    }
  }
  vi.stubGlobal("FormData", NativeFormData);
  const hb = Handlebars.create();
  hb.registerHelper("localize", (key: string) => key);
  hb.registerHelper("disabled", (value: unknown) => (value ? "disabled" : ""));
  hb.registerHelper("checked", (value: unknown) => (value ? "checked" : ""));
  hb.registerHelper("not", (value: unknown) => !value);
  hb.registerHelper("eq", (a: unknown, b: unknown) => a === b);
  hb.registerHelper("concat", (...values: unknown[]) =>
    values.slice(0, -1).join(""),
  );
  class NativeApplication {
    element = document.createElement("form");
    rendered = false;
    constructor() {
      document.body.append(this.element);
      Object.defineProperty(this.element, "elements", {
        get: () =>
          this.element.querySelectorAll("input,select,textarea,button"),
      });
    }
    _prepareContext(): Promise<Record<string, unknown>> {
      return Promise.resolve({});
    }
    _onRender(): Promise<void> {
      return Promise.resolve();
    }
    async render() {
      const context = await this._prepareContext();
      const template =
        kind !== "advanced" ? "edition-settings.hbs" : "rules-profile.hbs";
      this.element.innerHTML = hb.compile(
        readFileSync(
          process.env.D6_SETTINGS_TEMPLATE_ROOT
            ? `${process.env.D6_SETTINGS_TEMPLATE_ROOT}/${template}`
            : new URL(
                `../../../../templates/settings/${template}`,
                import.meta.url,
              ),
          "utf8",
        ),
      )(context);
      this.rendered = true;
      await this._onRender();
      return this;
    }
    close() {
      this.rendered = false;
      return Promise.resolve();
    }
  }
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        ApplicationV2: NativeApplication,
        HandlebarsApplicationMixin: (base: unknown) => base,
      },
    },
    utils: { randomID: () => `generated${++sequence}` },
  });
  const library = await import("./rules-profile-library");
  const profile =
    loadedProfile ??
    library.normalizeRulesProfile({
      id: "table",
      label: "Table",
      source: { kind: "world" },
    });
  values.set("worldRulesProfiles", {
    activeProfileId: profile.id,
    profiles: { [profile.id]: profile },
    version: 5,
  });
  const C =
    kind === "first"
      ? (await import("./settings-application")).D6System2eFirstEditionSettings
      : kind === "normal"
        ? (await import("./settings-application"))
            .D6System2eSecondEditionSettings
        : (await import("./rules-profile-application"))
            .D6System2eRulesProfileApplication;
  const app = new C();
  const options = C.DEFAULT_OPTIONS as unknown as {
    actions: Record<
      string,
      (this: unknown, event: Event, button: HTMLElement) => Promise<void>
    >;
    form: {
      handler: (
        this: unknown,
        event: unknown,
        form: unknown,
        data: { object: Record<string, string | boolean> },
      ) => Promise<void>;
    };
  };
  const action = async (name: string, id = "") => {
    const button = document.createElement("button");
    button.dataset.action = name;
    button.dataset.difficultyId = id;
    const handler = options.actions[name];
    if (!handler) throw new Error(`Missing action ${name}`);
    await handler.call(app, new window.Event("click"), button);
  };
  const field = (name: string) => {
    const input = app.element.querySelector<HTMLInputElement>(
      `[name="${name}"]`,
    );
    if (!input) throw new Error(`Missing ${name}`);
    return input;
  };
  const rows = () =>
    Array.from(
      app.element.querySelectorAll<HTMLElement>("li[data-difficulty-id]"),
    )
      .map((e) => e.dataset.difficultyId)
      .filter((id): id is string => Boolean(id));
  const save = (forged: Record<string, string> = {}) =>
    options.form.handler.call(app, undefined, app.element, {
      object: {
        ...Object.fromEntries(
          new NativeFormData(app.element as HTMLFormElement).data,
        ),
        ...Object.fromEntries(
          Array.from(
            app.element.querySelectorAll<HTMLInputElement>(
              'input[type="checkbox"][name]',
            ),
          ).map((input) => [input.name, input.checked]),
        ),
        ...forged,
      },
    });
  return {
    app,
    action,
    field,
    rows,
    save,
    user,
    values,
    profile,
    library,
    actors,
  };
}

afterEach(() => vi.unstubAllGlobals());

for (const kind of ["normal", "advanced"] as const)
  describe(`${kind} difficulty editor actual actions and templates`, () => {
    it("preserves unsaved text across add/delete and tabs, saves stable custom anchors, and restores defaults on cancellation", async () => {
      const f = await setup(kind);
      await f.app.render(true);
      f.field("profile.label").value = "Unsaved profile label";
      f.field("difficulty.easy.label").value = "Routine";
      const external =
        kind === "normal"
          ? f.app.element.querySelector<HTMLInputElement>(
              '[name="defaultDifficulty"]',
            )
          : null;
      if (external) external.value = "23";
      await f.action("addDifficultyLevel");
      const id = f.rows().find((id) => id.startsWith("custom-"));
      if (!id) throw new Error("No custom row");
      expect(
        f.field(`difficulty.${id}.label`).getAttribute("aria-invalid"),
      ).not.toBe("true");
      expect(f.app.element.querySelector('[data-errors="true"]')).toBeNull();
      expect(document.activeElement).toBe(f.field(`difficulty.${id}.label`));
      if (external) expect(f.field("defaultDifficulty").value).toBe("23");
      expect(f.field("profile.label").value).toBe("Unsaved profile label");
      expect(f.field("difficulty.easy.label").value).toBe("Routine");
      f.field(`difficulty.${id}.label`).value = "Between";
      f.field(`difficulty.${id}.value`).value = "17";
      // Tab changes keep the same form and must not save or discard draft inputs.
      f.app.element
        .querySelector<HTMLElement>(
          kind === "normal"
            ? '[data-settings-tab="profile"]'
            : '[data-rules-profile-tab="identity"]',
        )
        ?.click();
      await f.action("removeDifficultyLevel", "easy");
      expect(f.field("difficulty.easy.label").value).toBe("Routine");
      await f.save();
      const stored = f.library.storedWorldRulesProfiles().profiles.table;
      expect(stored?.difficultyLadder.find((e) => e.id === id)).toEqual({
        id,
        label: "Between",
        value: 17,
      });
      expect(stored?.difficultyLadder.map((e) => e.value)).toEqual([
        5, 10, 15, 17, 20, 30, 35,
      ]);
      expect(
        f.library.importRulesProfile(f.library.exportRulesProfile(stored))
          .difficultyLadder,
      ).toEqual(stored?.difficultyLadder);
      if (!stored) throw new Error("Saved profile missing");
      const reopened = await setup(kind, stored);
      await reopened.app.render(true);
      expect(reopened.field(`difficulty.${id}.label`).value).toBe("Between");
      const before = structuredClone(reopened.values.get("worldRulesProfiles"));
      await reopened.action("removeDifficultyLevel", id);
      expect(document.activeElement).toBe(
        reopened.field("difficulty.difficult.label"),
      );
      await reopened.action("addDifficultyLevel");
      await reopened.app.close();
      expect(reopened.values.get("worldRulesProfiles")).toEqual(before);
    });
    it("retains invalid draft fields across rerenders, rejects duplicate values, and blocks player mutation", async () => {
      const f = await setup(kind);
      await f.app.render(true);
      await f.action("addDifficultyLevel");
      const id = f.rows().find((id) => id.startsWith("custom-"));
      if (!id) throw new Error("No row");
      f.field(`difficulty.${id}.value`).value = "";
      await f.action("addDifficultyLevel");
      expect(f.field(`difficulty.${id}.value`).value).toBe("");
      const other = f
        .rows()
        .find((row) => row.startsWith("custom-") && row !== id);
      if (!other) throw new Error("No second row");
      await f.action("removeDifficultyLevel", other);
      f.field(`difficulty.${id}.label`).value = "Duplicate";
      f.field(`difficulty.${id}.value`).value = "15";
      await f.save();
      expect(
        f.field(`difficulty.${id}.value`).getAttribute("aria-invalid"),
      ).toBe("true");
      expect(
        f.library.storedWorldRulesProfiles().profiles.table?.difficultyLadder,
      ).toHaveLength(6);
      f.user.isGM = false;
      const count = f.rows().length;
      await f.action("addDifficultyLevel");
      await f.action("removeDifficultyLevel", id);
      await f.save();
      expect(f.rows()).toHaveLength(count);
      expect(
        f.library.storedWorldRulesProfiles().profiles.table?.difficultyLadder,
      ).toHaveLength(6);
    });
  });

describe("bound genre control in the actual Rules Configure form", () => {
  it("shows the bound provider, disables the legacy selector and ignores a forged global-genre form value", async () => {
    const f = await setup("first");
    const { firstEditionGenreProfileRegistry } =
      await import("../registries/first-edition-genre-profiles");
    const { settingProfileRegistry, normalizeSettingProfile } =
      await import("./setting-profile");
    const id = "bound-ui-genre";
    const attributes = [
      "reflexes",
      "coordination",
      "physique",
      "knowledge",
      "perception",
      "presence",
    ].map((id) => ({ id, label: id }));
    firstEditionGenreProfileRegistry.register(id, {
      id,
      genreId: id,
      label: "Bound human-readable genre",
      version: 1,
      attributes,
      roles: {
        initiative: "perception",
        knowledge: "knowledge",
        strength: "physique",
      },
      attributeBudgetScore: 54,
      skillBudgetScore: 21,
      skills: [],
    });
    const profile = f.library.normalizeRulesProfile({
      ...f.profile,
      firstEditionGenreProfile: { version: 1, id },
      strategies: {
        ...f.profile.strategies,
        attributes: "open-d6.attributes.six-attribute",
      },
    });
    f.values.set("worldRulesProfiles", {
      version: 5,
      activeProfileId: profile.id,
      profiles: { [profile.id]: profile },
    });
    settingProfileRegistry.register(
      id,
      normalizeSettingProfile({
        id: "bound-ui-setting",
        attributes,
        skills: [],
      }),
    );
    f.values.set("worldSettingProfiles", {
      version: 5,
      activeProfileId: "bound-ui-setting",
      profiles: {},
    });
    f.values.set("firstEditionGenrePackage", "preserved-legacy-genre");
    if (!("withRulesDraft" in f.app))
      throw new Error("Expected edition settings");
    f.app.withRulesDraft(profile);
    await f.app.render(true);
    const select = f.app.element.querySelector<HTMLSelectElement>(
      '[name="firstEditionGenrePackage"]',
    );
    expect(select?.disabled).toBe(true);
    expect(select?.textContent).toContain("Bound human-readable genre");
    await f.save({ firstEditionGenrePackage: "forged-new-genre" });
    expect(f.values.get("firstEditionGenrePackage")).toBe(
      "preserved-legacy-genre",
    );
    expect(f.values.get("worldRulesProfiles")).toMatchObject({
      profiles: {
        [profile.id]: { firstEditionGenreProfile: { version: 1, id } },
      },
    });
    firstEditionGenreProfileRegistry.unregisterOwner(id);
    settingProfileRegistry.unregisterOwner(id);
  });
});

for (const kind of ["first", "advanced"] as const) {
  describe(`${kind} initiative actual form options and single Save`, () => {
    it("renders unique exact strategy IDs with one legacy choice and preserves every selected strategy", async () => {
      const f = await setup(kind);
      const ids = [
        "d6e2.initiative.contextual",
        "open-d6.initiative.perception",
        "d6mv.initiative.side-readiness",
        "open-d6.initiative.perception-base",
        "open-d6.initiative.perception-reflexes",
      ];
      for (const id of ids) {
        const profile = f.library.normalizeRulesProfile({
          ...f.profile,
          strategies: { ...f.profile.strategies, initiative: id },
        });
        if ("withRulesDraft" in f.app) f.app.withRulesDraft(profile);
        else f.app.withDraft(profile);
        await f.app.render(true);
        const options = Array.from(
          f.app.element.querySelectorAll<HTMLOptionElement>(
            '[name="strategy.initiative"] option',
          ),
        );
        expect(options.map((o) => o.value)).toEqual(ids);
        expect(new Set(options.map((o) => o.value)).size).toBe(options.length);
        expect(
          options.filter((o) => o.value === "open-d6.initiative.perception"),
        ).toHaveLength(1);
        expect(
          options.filter((o) => o.hasAttribute("selected")).map((o) => o.value),
        ).toEqual([id]);
      }
    });
    it("switches a legacy world profile and persists strategy plus secondary with one Save, then reloads both", async () => {
      const f = await setup(kind);
      const legacy = f.library.normalizeRulesProfile({
        ...f.profile,
        strategies: {
          ...f.profile.strategies,
          initiative: "open-d6.initiative.perception",
          attributes: "open-d6.attributes.six-attribute",
        },
      });
      f.values.set("worldRulesProfiles", {
        version: 5,
        activeProfileId: legacy.id,
        profiles: { [legacy.id]: legacy },
      });
      if ("withRulesDraft" in f.app) f.app.withRulesDraft(legacy);
      else f.app.withDraft(legacy);
      await f.app.render(true);
      const strategy = f.field("strategy.initiative");
      strategy.value = "open-d6.initiative.perception-base";
      strategy.dispatchEvent(new window.Event("change", { bubbles: true }));
      const secondary = f.field(
        "profile.initiativeBaseTies.secondaryAttributeId",
      );
      expect(secondary.disabled).toBe(false);
      secondary.value = "agility";
      await f.save();
      const saved = f.library.storedWorldRulesProfiles().profiles[legacy.id];
      expect(saved).toMatchObject({
        strategies: { initiative: "open-d6.initiative.perception-base" },
        initiativeBaseTies: { version: 1, secondaryAttributeId: "agility" },
      });
      if (!saved) throw new Error("Missing saved profile");
      const reload = await setup(kind, saved);
      await reload.app.render(true);
      expect(reload.field("strategy.initiative").value).toBe(
        "open-d6.initiative.perception-base",
      );
      expect(
        reload.field("profile.initiativeBaseTies.secondaryAttributeId").value,
      ).toBe("agility");
      expect(
        reload.field("profile.initiativeBaseTies.secondaryAttributeId")
          .disabled,
      ).toBe(false);
    });
  });
}

for (const kind of ["normal", "first", "advanced"] as const) {
  describe(`${kind} mixed mechanics actual Save and reopen`, () => {
    for (const advancement of [
      "d6e2.advancement.configured",
      "open-d6.advancement.character-points",
    ]) {
      for (const metaCurrency of [
        "d6e2.meta-currency.hero-points",
        "open-d6.meta-currency.character-and-fate-points",
      ]) {
        it(`preserves unique canonical choices and all other strategies for ${advancement} / ${metaCurrency}`, async () => {
          const f = await setup(kind);
          await f.app.render(true);
          const resources = {
            characterPoints: { value: 31 },
            experiencePoints: { value: 79 },
          };
          const actor = { system: { resources }, update: vi.fn() };
          f.actors.push(actor);
          const before = structuredClone(resources);
          f.field("strategy.advancement").value = advancement;
          f.field("strategy.metaCurrency").value = metaCurrency;
          await f.save();
          const saved =
            f.library.storedWorldRulesProfiles().profiles[f.profile.id];
          expect(saved?.strategies).toEqual({
            ...f.profile.strategies,
            advancement,
            metaCurrency,
          });
          expect(resources).toEqual(before);
          expect(actor.update).not.toHaveBeenCalled();
          if (!saved) throw new Error("Missing saved profile");
          const reopened = await setup(kind, saved);
          await reopened.app.render(true);
          for (const select of Array.from(
            reopened.app.element.querySelectorAll<HTMLSelectElement>(
              'select[name^="strategy."]',
            ),
          )) {
            const options = Array.from(select.querySelectorAll("option"));
            expect(new Set(options.map((o) => o.value)).size, select.name).toBe(
              options.length,
            );
            const slot = select.name.slice(
              "strategy.".length,
            ) as keyof typeof saved.strategies;
            expect(
              options
                .filter((o) => o.hasAttribute("selected"))
                .map((o) => o.value),
              select.name,
            ).toEqual([saved.strategies[slot]]);
          }
          const cpOption = reopened.app.element.querySelector(
            '[name="strategy.advancement"] option[value="open-d6.advancement.character-points"]',
          );
          expect(cpOption?.textContent.trim()).toBe(
            "D6E2.Settings.GameMode.OpenD6",
          );
          const attributeOption = reopened.app.element.querySelector(
            '[name="strategy.attributes"] option[value="d6e2.attributes.campaign-profile"]',
          );
          expect(attributeOption?.textContent.trim()).toBe(
            "D6E2.Settings.GameMode.SecondEdition",
          );
          await reopened.save();
          expect(
            reopened.library.storedWorldRulesProfiles().profiles[saved.id]
              ?.strategies,
          ).toEqual(saved.strategies);
        });
      }
    }
  });
}

describe("sheet activation drafts in the real settings editor", () => {
  it.each([
    ["hideouts", ["secondEditionHiddenBasesModule"]],
    [
      "gadgetsGear",
      ["secondEditionGadgetsGearModule", "secondEditionSuperpowersModule"],
    ],
    ["superpowers", ["secondEditionSuperpowersModule"]],
  ] as const)(
    "opens %s at its control without persisting settings",
    async (rule, keys) => {
      const f = await setup("normal");
      if (!("withRuleActivation" in f.app))
        throw new Error("Missing activation route");
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: vi.fn(),
      });
      const before = structuredClone([...f.values]);
      f.app.withRuleActivation(rule);
      await f.app.render(true);
      for (const key of keys) expect(f.field(key).checked).toBe(true);
      expect(
        f.app.element
          .querySelector('[data-settings-panel="modules"]')
          ?.classList.contains("is-active"),
      ).toBe(true);
      expect(document.activeElement).toBe(f.field(keys[0]));
      expect(
        f.app.element.querySelector('.d6e2-settings-hero [role="status"]')
          ?.textContent,
      ).toContain(`D6E2.RuleActivation.${rule}.Help`);
      expect([...f.values]).toEqual(before);
      await f.app.close();
      expect([...f.values]).toEqual(before);
    },
  );

  it.each([false, true])(
    "preserves Hideout prerequisite confirmation (accept=%s)",
    async (accept) => {
      const f = await setup("normal");
      if (!("withRuleActivation" in f.app))
        throw new Error("Missing activation route");
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: vi.fn(),
      });
      const confirm = vi.fn(() => Promise.resolve(accept));
      Object.assign(foundry.applications.api, { DialogV2: { wait: confirm } });
      const before = structuredClone([...f.values]);
      f.app.withRuleActivation("hideouts");
      await f.app.render(true);
      await f.save();
      expect(confirm).toHaveBeenCalledOnce();
      if (accept) {
        expect(f.values.get("secondEditionHiddenBasesModule")).toBe(true);
        expect(f.values.get("secondEditionPerksFlawsTalentsModule")).toBe(true);
      } else expect([...f.values]).toEqual(before);
    },
  );

  it("ignores a direct player activation draft request", async () => {
    const f = await setup("normal");
    f.user.isGM = false;
    if (!("withRuleActivation" in f.app))
      throw new Error("Missing activation route");
    f.app.withRuleActivation("hideouts");
    await f.app.render(true);
    expect(f.field("secondEditionHiddenBasesModule").checked).not.toBe(true);
    expect(
      f.app.element.querySelector('.d6e2-settings-hero [role="status"]'),
    ).toBeNull();
  });
});
