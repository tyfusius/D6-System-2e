import { record } from "./values";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function setup(
  mode: "body-points" | "body-points-with-wounds" | "wounds",
  current: number,
  maximum: number,
) {
  const user = { id: "gm", isGM: true };
  const values = new Map<string, unknown>([
    ["gameMode", "open-d6"],
    ["firstEditionBodyPoints", mode],
    [
      "worldRulesProfiles",
      { version: 1, activeProfileId: "open-d6", profiles: {} },
    ],
  ]);
  const { document, window } = parseHTML("<html><body></body></html>");
  const actor = {
    id: "sentinel",
    uuid: "Actor.sentinel",
    name: "Patient",
    type: "character",
    isOwner: true,
    system: {
      attributes: {},
      health: {
        firstEditionBodyPoints: { current, maximum },
        firstEditionWound: "mortally-wounded",
        firstEditionState: {
          source: "mortally-wounded",
          consciousness: "unconscious",
          mortalityRounds: 60,
        },
        tracks: {},
      },
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
  const { D6System2eCharacterSheet } = await import("./character-sheet");
  const sheet = new D6System2eCharacterSheet();
  return { sheet, actor, values, user };
}

describe("Body Point natural healing actual sheet VM", () => {
  it.each([
    ["body-points", 2, 21, true, true],
    ["body-points", 0, 20, true, true],
    ["body-points", -20, 21, true, true],
    ["body-points", -21, 21, false, false],
    ["body-points-with-wounds", 2, 21, false, true],
    ["body-points-with-wounds", 3, 21, true, true],
    ["body-points-with-wounds", -21, 21, false, false],
  ] as const)(
    "%s %i/%i keeps natural=%s assisted=%s",
    async (mode, current, maximum, natural, assisted) => {
      const { sheet, actor } = await setup(mode, current, maximum);
      const before = structuredClone(actor.system);
      const vm = await sheet._prepareContext();
      expect(record(vm.combat).firstEditionHealing).toMatchObject({
        canHealNaturally: natural,
        canAssist: assisted,
      });
      expect(actor.system).toEqual(before);
      expect(actor.update).not.toHaveBeenCalled();
    },
  );
  it("does not change Wound-family mortal natural eligibility", async () => {
    const { sheet } = await setup("wounds", 0, 20);
    const vm = await sheet._prepareContext();
    expect(record(vm.combat).firstEditionHealing).toMatchObject({
      canHealNaturally: true,
      canAssist: true,
    });
  });
});
