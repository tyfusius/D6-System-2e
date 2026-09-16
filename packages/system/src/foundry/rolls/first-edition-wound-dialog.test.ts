import { currentConfiguredHealthModel } from "../../settings/health-model-library";
import { currentConfiguredRulesProfile } from "../../settings/rules-profile-library";
import { readActorHealth } from "../health-runtime";
import type * as ActionEconomy from "../../settings/action-economy";
import type * as CombatService from "../combat-service";
import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { D6RollRequestV1 } from "@d6-system-2e/core";
import {
  rollFirstEditionHealingCheck,
  rollFirstEditionAutomatedMortalityCheck,
} from "./roll-service";
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

function mortalPenaltyFixture(): void {
  const model = currentConfiguredHealthModel(currentConfiguredRulesProfile());
  if (model.kind !== "track") throw new Error("Expected Wound track");
  const original = game.settings.get.bind(game.settings);
  vi.spyOn(game.settings, "get").mockImplementation((scope, key) =>
    key === "worldRulesProfiles"
      ? {
          version: 3,
          activeProfileId: "custom",
          profiles: {
            custom: {
              id: "custom",
              label: "Custom",
              source: { kind: "world" },
              strategies: { health: "custom.health.wounds" },
              healthModels: [
                {
                  ...model,
                  id: "custom.health.wounds",
                  label: "Custom wounds",
                  track: {
                    ...model.track,
                    states: model.track.states.map((state) =>
                      state.id === "mortally-wounded"
                        ? { ...state, penaltyScore: 6 }
                        : state,
                    ),
                  },
                },
              ],
            },
          },
        }
      : original(scope, key),
  );
  actor.system.health = {
    firstEditionWound: "healthy",
    tracks: { "custom%2Ehealth%2Ewounds": { stateId: "mortally-wounded" } },
  };
}

function chooseMode(root: HTMLElement, mode: string): void {
  const select = root.querySelector<HTMLSelectElement>('[name="rollMode"]');
  if (!select) throw new Error("Missing visibility selector");
  for (const option of Array.from(select.querySelectorAll("option")))
    option.toggleAttribute("selected", option.value === mode);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("held Wound lifecycle with accepted collapsed roll window", () => {
  it.each([
    "open-d6.action-economy.flexible",
    "open-d6.action-economy.segmented",
    "d6e2.action-economy.segmented",
  ])(
    "does not apply tracked MAP to recovery or Medicine under %s",
    async (strategy) => {
      probe.strategy = strategy;
      for (const medicine of [undefined, "medicine"]) {
        const beforeDice = vi.fn<(request: D6RollRequestV1) => Promise<void>>(
          () => {
            throw stopped;
          },
        );
        actualDialog((root) => {
          expect(root.querySelector('[name="mapPenaltyDice"]')).toBeNull();
          expect(root.querySelector("[data-manual-opposition]")).toBeNull();
          expect(
            root.querySelector("[data-roll-options]")?.hasAttribute("open"),
          ).toBe(false);
          expect(
            root.querySelector("[data-final-difficulty]")?.textContent,
          ).toBe("10");
        });
        await expect(
          rollFirstEditionHealingCheck(actor, "Recovery", 10, medicine, {
            beforeDice,
            suppressChatMessage: true,
          }),
        ).rejects.toBe(stopped);
        const request = beforeDice.mock.calls[0]?.[0];
        expect(request?.score).toBe(medicine ? 15 : 12);
        expect(request?.context?.actionEconomy?.mapPenaltyScore ?? 0).toBe(0);
        expect(request?.difficulty).toBe(10);
        expect(roll).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
      }
    },
  );
  it.each([
    {
      label: "Natural recovery",
      wound: "incapacitated",
      medicine: false,
      penalty: 9,
    },
    {
      label: "Medicine",
      wound: "severely-wounded",
      medicine: true,
      penalty: 6,
    },
    {
      label: "Manual mortality",
      wound: "mortally-wounded",
      medicine: false,
      penalty: 6,
    },
  ])(
    "uses the verified injury treatment without MAP for $label",
    async ({ label, wound, medicine, penalty }) => {
      actor.system.health = {
        firstEditionWound: "healthy",
        tracks: { "open-d6%2Ehealth%2Ewound-track": { stateId: wound } },
      };
      if (wound === "mortally-wounded") mortalPenaltyFixture();
      if (!medicine && wound === "incapacitated")
        actor.system.attributes = { brawn: { score: 9 } };
      if (medicine) {
        Object.assign(actor, { id: "healer", name: "Healer" });
        actor.system.attributes = {
          brawn: { score: 12 },
          knowledge: { score: 18 },
        };
        Object.assign(actor.items, {
          get: (id: string) =>
            id === "medicine"
              ? {
                  id,
                  name: "Medicine",
                  type: "skill",
                  system: { attributeId: "knowledge", score: 3 },
                }
              : undefined,
        });
      }
      // A differently wounded patient must not supply the healer's penalty.
      const patient = {
        ...actor,
        id: "patient",
        name: "Patient",
        system: {
          ...actor.system,
          health: { firstEditionWound: "incapacitated", tracks: {} },
        },
      } as FoundryActorDocument;
      Object.assign(game, {
        actors: {
          contents: [actor, patient],
          get: (id: string) => (id === patient.id ? patient : actor),
        },
      });
      const projection = readActorHealth(actor);
      expect(projection.track?.currentStateId).toBe(wound);
      expect(projection.track?.currentState.penaltyScore).toBe(penalty);
      if (medicine)
        expect(readActorHealth(patient).track?.currentState.penaltyScore).toBe(
          9,
        );
      const beforeDice = vi.fn<(request: D6RollRequestV1) => Promise<void>>(
        () => {
          throw stopped;
        },
      );
      actualDialog((root) => {
        expect(root.querySelector('[name="mapPenaltyDice"]')).toBeNull();
        expect(
          root.querySelector("[data-roll-options]")?.hasAttribute("open"),
        ).toBe(false);
      });
      await expect(
        rollFirstEditionHealingCheck(
          actor,
          label,
          10,
          medicine ? "medicine" : undefined,
          { beforeDice, suppressChatMessage: true },
        ),
      ).rejects.toBe(stopped);
      const request = beforeDice.mock.calls[0]?.[0];
      expect(request?.score).toBe(
        medicine ? 21 - penalty : wound === "incapacitated" ? 9 : 12,
      );
      expect(request?.context?.actionEconomy?.conditionPenaltyScore ?? 0).toBe(
        medicine ? penalty : 0,
      );
      expect(request?.source.actorId).toBe(medicine ? "healer" : "actor");
      expect(request?.source.attributeId).toBe(
        medicine ? "knowledge" : "brawn",
      );
      expect(request?.source.itemId).toBe(medicine ? "medicine" : undefined);
      expect(request?.difficulty).toBe(10);
      expect(request?.context?.actionEconomy?.mapPenaltyScore ?? 0).toBe(0);
      expect(roll).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );
  it.each(["publicroll", "gmroll", "blindroll", "selfroll"])(
    "passes selected %s unchanged to Wound's first pre-dice admission",
    async (mode) => {
      const beforeDice = vi.fn<(request: D6RollRequestV1) => Promise<void>>(
        () => {
          throw stopped;
        },
      );
      actualDialog((root) => {
        chooseMode(root, mode);
        expect(
          root.querySelector("[data-roll-options]")?.hasAttribute("open"),
        ).toBe(false);
        expect(
          root.querySelector("[data-roll-options-summary]")?.textContent,
        ).toContain(
          localize(
            `D6E2.Roll.Mode.${({ publicroll: "Public", gmroll: "Gm", blindroll: "Blind", selfroll: "Self" } as Record<string, string>)[mode]}`,
          ),
        );
      });
      await expect(
        rollFirstEditionHealingCheck(actor, "Recovery", 10, undefined, {
          beforeDice,
          suppressChatMessage: true,
        }),
      ).rejects.toBe(stopped);
      expect(beforeDice.mock.calls[0]?.[0].rollMode).toBe(mode);
      expect(viewModel.rollVisibility).toMatchObject({ locked: false });
      expect(roll).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );
  it("cancels before Wound's audience admission, preparation or dice", async () => {
    const beforeDice = vi.fn();
    actualDialog((root) => chooseMode(root, "blindroll"), true);
    await expect(
      rollFirstEditionHealingCheck(actor, "Recovery", 10, undefined, {
        beforeDice,
        suppressChatMessage: true,
      }),
    ).resolves.toBeNull();
    expect(beforeDice).not.toHaveBeenCalled();
    expect(probe.prepare).not.toHaveBeenCalled();
    expect(roll).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it("rejects a forged manual opposed total before Wound admission or preparation", async () => {
    const beforeDice = vi.fn();
    actualDialog((root) => {
      const input = root.ownerDocument.createElement("input");
      input.name = "oppositionTotal";
      input.type = "number";
      input.value = "0";
      Object.defineProperty(input, "validity", { value: { badInput: false } });
      root.querySelector("form")?.append(input);
    });
    await expect(
      rollFirstEditionHealingCheck(actor, "Recovery", 10, undefined, {
        beforeDice,
        suppressChatMessage: true,
      }),
    ).rejects.toThrow();
    expect(beforeDice).not.toHaveBeenCalled();
    expect(probe.prepare).not.toHaveBeenCalled();
    expect(roll).not.toHaveBeenCalled();
  });
  it("keeps scheduled mortality on the mandatory prepared Strength path without MAP or a dialog", async () => {
    mortalPenaltyFixture();
    expect(readActorHealth(actor).track?.currentState.penaltyScore).toBe(6);
    const wait = vi.spyOn(foundry.applications.api.DialogV2, "wait");
    const beforeDice = vi.fn<(request: D6RollRequestV1) => Promise<void>>(
      () => {
        throw stopped;
      },
    );
    await expect(
      rollFirstEditionAutomatedMortalityCheck(
        actor,
        "Mortality",
        2,
        {
          checkId: "combat:round:24",
          completedRounds: 24,
          elapsedMinutes: 2,
          sourcePage: 76,
        },
        { beforeDice, suppressChatMessage: true },
      ),
    ).rejects.toBe(stopped);
    const request = beforeDice.mock.calls[0]?.[0];
    expect(request?.score).toBe(12);
    expect(request?.difficulty).toBe(2);
    expect(request?.context?.firstEditionMortality?.elapsedMinutes).toBe(2);
    expect(request?.context?.actionEconomy).toBeUndefined();
    expect(wait).not.toHaveBeenCalled();
    expect(roll).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
