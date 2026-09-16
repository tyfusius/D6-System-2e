import { readActorHealth } from "../health-runtime";
import type * as ActionEconomy from "../../settings/action-economy";
import type * as CombatService from "../combat-service";
import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { D6RollRequestV1 } from "@d6-system-2e/core";
import { rollFirstEditionRecoveryCheck } from "./roll-service";
import { rollDialogLocalize as localize } from "./roll-dialog.test-fixtures";

const probe = vi.hoisted(() => ({
  prepare: vi.fn(),
  strategy: "open-d6.action-economy.flexible",
}));
vi.mock("../../settings/action-economy", async (importOriginal) => {
  const original = await importOriginal<typeof ActionEconomy>();
  return {
    ...original,
    currentActionEconomyRuntimeStrategy: () =>
      original.actionEconomyRuntimeStrategy(probe.strategy),
  };
});
vi.mock("../combat-service", async (importOriginal) => ({
  ...(await importOriginal<typeof CombatService>()),
  readCombatantRound: () => ({
    round: 12,
    actions: [
      { kind: "skill" },
      { kind: "skill" },
      { kind: "skill" },
      { kind: "skill" },
    ],
    actionPenaltyScore: 9,
    firstEditionCommitment: { plannedActionCount: 4 },
    firstEditionActionPenaltyScore: 9,
    movementSkillPenaltyScore: 6,
  }),
}));
vi.mock("../destiny-effects", () => ({ prepareDestinyRoll: probe.prepare }));
const stopped = new Error("stop-before-dice-and-costs");
let dialogResult: Record<string, unknown>;
let viewModel: Record<string, unknown>;
let actor: FoundryActorDocument;
const update = vi.fn();
const roll = vi.fn();
beforeEach(() => {
  probe.strategy = "open-d6.action-economy.flexible";
  probe.prepare
    .mockReset()
    .mockImplementation((_actor: object, request: D6RollRequestV1) =>
      Promise.resolve(request),
    );
  update.mockReset();
  roll.mockReset();
  viewModel = {};
  dialogResult = {
    characterPointSpend: 0,
    fatePointUse: "none",
    heroPointSpend: 0,
    heroPointUse: "none",
    manualDiceAdjustment: 0,
    mapPenaltyDice: 0,
    resultModifier: 0,
    rollMode: "publicroll",
    selectedDistinctionEffectIds: [],
  };
  actor = {
    id: "actor",
    name: "Example",
    type: "npc",
    isOwner: true,
    system: {
      attributes: { brawn: { score: 12 } },
      resources: {},
      health: {},
    },
    items: {
      contents: [],
      get: (id: string) =>
        id === "medicine"
          ? {
              id,
              name: "Medicine",
              type: "skill",
              system: { attributeId: "brawn", score: 3 },
            }
          : undefined,
    },
    getFlag: () => undefined,
    update,
  } as unknown as FoundryActorDocument;
  vi.stubGlobal("game", {
    user: { id: "owner", isGM: true, targets: new Set() },
    actors: { contents: [actor], get: () => actor },
    settings: {
      get: (_scope: string, key: string) =>
        key === "worldRulesProfiles"
          ? { activeProfileId: "open-d6", profiles: {}, version: 1 }
          : key === "gameMode"
            ? "open-d6"
            : undefined,
    },
    i18n: { localize, format: localize },
    modules: new Map(),
  });
  vi.stubGlobal("canvas", { tokens: { controlled: [], placeables: [] } });
  vi.stubGlobal("ui", { notifications: { warn: vi.fn(), error: vi.fn() } });
  vi.stubGlobal("Roll", roll);
  vi.stubGlobal("foundry", {
    utils: { randomID: () => "id" },
    applications: {
      handlebars: {
        renderTemplate: (_path: string, data: Record<string, unknown>) => {
          viewModel = data;
          return Promise.resolve("template");
        },
      },
      api: { DialogV2: { wait: () => Promise.resolve(dialogResult) } },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

interface DialogProbe {
  render(event: Event, dialog: { element: HTMLElement }): void;
  buttons: {
    action: string;
    callback(event: Event, button: { form: HTMLFormElement }): unknown;
  }[];
}
function actualDialog(
  interact: (root: HTMLElement) => void,
  cancel = false,
): void {
  const hbs = Handlebars.create();
  hbs.registerHelper(
    "localize",
    (key: string, options: { hash: Record<string, string> }) =>
      Object.entries(options.hash).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, value),
        localize(key),
      ),
  );
  const template = hbs.compile(
    readFileSync(
      new URL("../../../../../templates/roll/dialog.hbs", import.meta.url),
      "utf8",
    ),
  );
  const runtime = foundry as unknown as {
    applications: {
      api: { DialogV2: { wait(options: DialogProbe): Promise<unknown> } };
    };
  };
  runtime.applications.api.DialogV2.wait = (options) => {
    const { document, window } = parseHTML(
      `<html><body><main><form>${template(viewModel)}</form></main></body></html>`,
    );
    const root = document.querySelector("main") as unknown as HTMLElement;
    const form = root.querySelector("form");
    if (!form) throw new Error("Missing dialog form");
    vi.stubGlobal("HTMLInputElement", window.HTMLInputElement);
    vi.stubGlobal("HTMLSelectElement", window.HTMLSelectElement);
    vi.stubGlobal("HTMLElement", window.HTMLElement);
    vi.stubGlobal("Event", window.Event);
    vi.stubGlobal("requestAnimationFrame", () => 0);
    Object.defineProperty(form, "elements", {
      value: {
        namedItem: (name: string) => form.querySelector(`[name="${name}"]`),
      },
    });
    for (const input of Array.from(form.querySelectorAll("input")))
      Object.defineProperty(input, "validity", { value: { badInput: false } });
    for (const select of Array.from(form.querySelectorAll("select")))
      Object.defineProperty(select, "selectedOptions", {
        get: () => Array.from(select.querySelectorAll("option[selected]")),
      });
    options.render(new window.Event("render"), { element: root });
    interact(root);
    if (cancel) return Promise.resolve(null);
    const button = options.buttons.find((button) => button.action === "roll");
    if (!button) throw new Error("Missing Roll button");
    return Promise.resolve(
      button.callback(new window.Event("click"), { form }),
    );
  };
}

function chooseMode(root: HTMLElement, mode: string): void {
  const select = root.querySelector<HTMLSelectElement>('[name="rollMode"]');
  if (!select) throw new Error("Missing visibility selector");
  for (const option of Array.from(select.querySelectorAll("option")))
    option.toggleAttribute("selected", option.value === mode);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Body Point natural request preserves accepted rest score", () => {
  it.each([-3, 0, 3] as const)(
    "keeps hybrid injury/MAP out of rest modifier %i",
    async (rest) => {
      const original = game.settings.get.bind(game.settings);
      vi.spyOn(game.settings, "get").mockImplementation((scope, key) =>
        key === "firstEditionBodyPoints"
          ? "body-points-with-wounds"
          : original(scope, key),
      );
      actor.system.health = {
        firstEditionBodyPoints: { current: 10, maximum: 30 },
        firstEditionWound: "severely-wounded",
        firstEditionState: {},
      };
      expect(
        readActorHealth(actor).track?.currentState.penaltyScore,
      ).toBeGreaterThan(0);
      actualDialog((root) => chooseMode(root, "blindroll"));
      let request: D6RollRequestV1 | undefined;
      await expect(
        rollFirstEditionRecoveryCheck(
          actor,
          "Natural Body Point healing",
          "brawn",
          undefined,
          undefined,
          12 + rest,
          false,
          undefined,
          {
            beforeDice: async (value) => {
              await Promise.resolve();
              request = value;
              throw stopped;
            },
          },
        ),
      ).rejects.toBe(stopped);
      expect(request?.score).toBe(12 + rest);
      expect(request?.rollMode).toBe("blindroll");
      expect(request?.difficulty).toBeUndefined();
      expect(update).not.toHaveBeenCalled();
      expect(roll).not.toHaveBeenCalled();
    },
  );
});
