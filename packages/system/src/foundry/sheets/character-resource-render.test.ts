import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEchoRulesProfile } from "../../../../echod6-companion-d6-system-2e/src/rules-profile";

const root = new URL("../../../../../", import.meta.url);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function setup(
  advancement: string,
  metaCurrency: string,
  classic = false,
) {
  const user = { id: "gm", isGM: true };
  const values = new Map<string, unknown>([
    ["secondEditionAdvancementStrategy", "experience-points"],
    ["secondEditionWildDieStrategy", classic ? "classic" : "core"],
    ["secondEditionHeroPointStrategy", classic ? "classic" : "heroic"],
  ]);
  const { document, window } = parseHTML("<html><body></body></html>");
  const actor = {
    id: "sentinel",
    name: "Echo sentinel",
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
  class NativeSheet {
    actor = actor;
    isEditable = true;
    tabGroups = { primary: "attributes" };
    element = document.createElement("form");
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
      randomID: () => "resource-scope",
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
    id: "echo-sentinel",
    source: { kind: "world" },
    strategies: { ...echo.strategies, advancement, metaCurrency },
    terminology: {
      ...echo.terminology,
      resources: {
        ...echo.terminology.resources,
        experiencePoints: "Echo CP label",
      },
    },
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
  return { sheet, actor, values, user };
}

const advancementIds = [
  "d6e2.advancement.configured",
  "open-d6.advancement.character-points",
];
const metaIds = [
  "d6e2.meta-currency.hero-points",
  "open-d6.meta-currency.character-and-fate-points",
];
describe("Echo mixed mechanics actual character context and header", () => {
  for (const classic of [false, true])
    for (const advancement of advancementIds)
      for (const meta of metaIds) {
        it(`${advancement} / ${meta} classic=${classic} renders independent balances without writing`, async () => {
          const { sheet, actor, user } = await setup(
            advancement,
            meta,
            classic,
          );
          const before = structuredClone(actor.system);
          const context = await sheet._prepareContext();
          const hb = Handlebars.create();
          hb.registerHelper("localize", (key: string) => key);
          hb.registerHelper("disabled", (value: unknown) =>
            value ? "disabled" : "",
          );
          hb.registerHelper("not", (value: unknown) => !value);
          hb.registerHelper("or", (...values: unknown[]) =>
            values.slice(0, -1).some(Boolean),
          );
          const html = hb.compile(
            readFileSync(
              process.env.D6_CHARACTER_HEADER_TEMPLATE ??
                new URL("templates/actor/character/header.hbs", root),
              "utf8",
            ),
          )(context);
          const { document } = parseHTML(html);
          const inputs = (name: string) =>
            document.querySelectorAll<HTMLInputElement>(
              `[name="system.resources.${name}.value"]`,
            );
          const resourceCards = document.querySelector(
            ".od6v2-resources.d6e2-resource-cards",
          );
          expect(resourceCards).not.toBeNull();
          const cp = advancement === advancementIds[1] || meta === metaIds[1];
          expect(inputs("characterPoints")).toHaveLength(cp ? 1 : 0);
          if (cp) expect(inputs("characterPoints")[0]?.value).toBe("31");
          const xp = advancement === advancementIds[0];
          const classicActive = classic && xp && meta === metaIds[0];
          expect(context.classicHeroPoints).toBe(classicActive);
          const xpVisible = xp;
          expect(inputs("experiencePoints")).toHaveLength(xpVisible ? 1 : 0);
          if (xpVisible)
            expect(inputs("experiencePoints")[0]?.value).toBe("79");
          expect(context.availableAdvancementResource).toBe(xp ? 79 : 31);
          expect(inputs("heroPoints")).toHaveLength(
            meta === metaIds[0] && !classicActive ? 1 : 0,
          );
          expect(inputs("fatePoints")).toHaveLength(
            meta === metaIds[1] ? 1 : 0,
          );
          for (const input of Array.from(
            document.querySelectorAll('input[name^="system.resources."]'),
          )) {
            expect(input.closest(".od6v2-resource")).not.toBeNull();
            expect(input.closest(".d6e2-resource-cards")).toBe(resourceCards);
          }
          expect(context.resourceLabels).toMatchObject({
            experiencePoints: "Echo CP label",
          });
          user.isGM = false;
          const playerContext = await sheet._prepareContext();
          const playerHtml = hb.compile(
            readFileSync(
              process.env.D6_CHARACTER_HEADER_TEMPLATE ??
                new URL("templates/actor/character/header.hbs", root),
              "utf8",
            ),
          )(playerContext);
          const playerDocument = parseHTML(playerHtml).document;
          for (const input of Array.from(
            playerDocument.querySelectorAll('input[name^="system.resources."]'),
          ))
            expect(input.hasAttribute("disabled")).toBe(true);
          expect(actor.system).toEqual(before);
          expect(actor.update).not.toHaveBeenCalled();
        });
      }
});
