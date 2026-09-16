import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  D6RollRequestV1,
  D6RequestedRollContextV1,
} from "@d6-system-2e/core";
import { rollAttribute, rollFirstEditionRecoveryCheck } from "./roll-service";
import { rollDialogLocalize as localize } from "./roll-dialog.test-fixtures";

const probe = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock("../destiny-effects", () => ({ prepareDestinyRoll: probe.prepare }));
const stopped = new Error("stop-before-dice-and-costs");
let dialogResult: Record<string, unknown>;
let viewModel: Record<string, unknown>;
let actor: FoundryActorDocument;
const update = vi.fn();
const roll = vi.fn();
const requested: D6RequestedRollContextV1 = {
  requestId: "request",
  requesterUserId: "gm",
  recipientUserId: "owner",
  rollMode: "blindroll",
  visibility: "hidden",
} as D6RequestedRollContextV1;
beforeEach(() => {
  probe.prepare.mockReset().mockImplementation(() => {
    throw stopped;
  });
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
      attributes: { agility: { score: 12 } },
      resources: {},
      health: {},
    },
    items: { contents: [], get: () => undefined },
    getFlag: () => undefined,
    update,
  } as unknown as FoundryActorDocument;
  vi.stubGlobal("game", {
    user: { id: "owner", isGM: true, targets: new Set() },
    actors: { contents: [actor], get: () => actor },
    settings: { get: () => undefined },
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

function oppose() {
  dialogResult.opposition = {
    total: 0,
    name: "Physical dice",
    actorKind: "non-player-character",
    opponentKind: "player-character",
  };
}
function untouched() {
  expect(probe.prepare).not.toHaveBeenCalled();
  expect(roll).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
}

describe("actual shared roll pipeline submission authority", () => {
  it("denies a forged opposition response on a fixed recovery check before preparation, dice or costs", async () => {
    oppose();
    await expect(
      rollFirstEditionRecoveryCheck(actor, "Recovery", "agility", 10),
    ).rejects.toThrow("OppositionUnavailable");
    expect(viewModel.showOppositionControls).toBe(false);
    untouched();
  });
  it("denies opposition for requested rolls before preparation, dice or costs", async () => {
    oppose();
    await expect(
      rollAttribute(actor, "agility", { requestedRoll: requested }),
    ).rejects.toThrow("OppositionUnavailable");
    expect(viewModel.showOppositionControls).toBe(false);
    untouched();
  });
  it.each([1.5, 100, Number.MAX_SAFE_INTEGER + 1])(
    "denies invalid manual dice %s even when the returned dialog result bypasses DOM validation",
    async (value) => {
      dialogResult.manualDiceAdjustment = value;
      await expect(rollAttribute(actor, "agility")).rejects.toThrow(
        "InvalidNumber",
      );
      untouched();
    },
  );
  it("admits a free manual opposed zero and derives the acting type from the actual actor", async () => {
    oppose();
    await expect(rollAttribute(actor, "agility")).rejects.toBe(stopped);
    expect(viewModel.showOppositionControls).toBe(true);
    expect(viewModel.actorKindNonPlayer).toBe(true);
    expect(viewModel.actorKindPlayer).toBe(false);
    const request = probe.prepare.mock.calls[0]?.[1] as D6RollRequestV1;
    expect(request.opposition?.total).toBe(0);
    expect(request.difficulty).toBeUndefined();
    expect(roll).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it("ignores a returned public mode for a locked requested blind roll", async () => {
    await expect(
      rollAttribute(actor, "agility", { requestedRoll: requested }),
    ).rejects.toBe(stopped);
    const request = probe.prepare.mock.calls[0]?.[1] as D6RollRequestV1;
    expect(request.rollMode).toBe("blindroll");
    expect(viewModel.rollVisibility).toMatchObject({
      mode: "blindroll",
      locked: true,
      label: "Blind GM roll",
    });
  });
});

interface DialogProbe {
  render(event: Event, dialog: { element: HTMLElement }): void;
  buttons: {
    action: string;
    callback(event: Event, button: { form: HTMLFormElement }): unknown;
  }[];
}
function actualDialog(interact: (root: HTMLElement) => void): void {
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
    const button = options.buttons.find((button) => button.action === "roll");
    if (!button) throw new Error("Missing Roll button");
    return Promise.resolve(
      button.callback(new window.Event("click"), { form }),
    );
  };
}
function enter(root: HTMLElement, name: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
  if (!input) throw new Error(`Missing ${name}`);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("real VM, template, render listeners and submit callback", () => {
  it("shows opposed zero, submits opposition alone, and returns to the same difficulty when cleared", async () => {
    actualDialog((root) => {
      enter(root, "difficulty", "15");
      enter(root, "oppositionTotal", "0");
      expect(root.querySelector("[data-final-difficulty]")?.textContent).toBe(
        "0",
      );
      expect(
        root.querySelector("[data-final-difficulty-label]")?.textContent,
      ).toBe("Opposed target");
      enter(root, "oppositionTotal", "");
      expect(root.querySelector("[data-final-difficulty]")?.textContent).toBe(
        "15",
      );
      enter(root, "oppositionTotal", "0");
    });
    await expect(rollAttribute(actor, "agility")).rejects.toBe(stopped);
    const request = probe.prepare.mock.calls[0]?.[1] as D6RollRequestV1;
    expect(request.opposition?.total).toBe(0);
    expect(request.difficulty).toBeUndefined();
  });
  it("retains a fixed preview when MAP and target controls are absent", async () => {
    actualDialog((root) => {
      expect(root.querySelector('[name="mapPenaltyDice"]')).toBeNull();
      expect(root.querySelector("[data-final-difficulty]")?.textContent).toBe(
        "10",
      );
      expect(root.querySelector("[data-manual-opposition]")).toBeNull();
    });
    await expect(
      rollFirstEditionRecoveryCheck(
        actor,
        "Recovery",
        "agility",
        10,
        undefined,
        undefined,
        true,
      ),
    ).rejects.toBe(stopped);
  });
  it.each(["publicroll", "gmroll", "blindroll", "selfroll"] as const)(
    "shows and enforces fixed-only %s even if hidden input is altered",
    async (mode) => {
      actualDialog((root) => {
        expect(
          root.querySelector('[name="rollMode"]')?.getAttribute("value"),
        ).toBe(mode);
        expect(
          root.querySelector("[data-roll-visibility-label]")?.textContent,
        ).toBe(
          localize(
            `D6E2.Roll.Mode.${{ publicroll: "Public", gmroll: "Gm", blindroll: "Blind", selfroll: "Self" }[mode]}`,
          ),
        );
        enter(root, "rollMode", "publicroll");
      });
      const options: NonNullable<Parameters<typeof rollAttribute>[2]> & {
        fixedRollMode: typeof mode;
      } = { fixedRollMode: mode };
      await expect(rollAttribute(actor, "agility", options)).rejects.toBe(
        stopped,
      );
      expect(
        (probe.prepare.mock.calls[0]?.[1] as D6RollRequestV1).rollMode,
      ).toBe(mode);
    },
  );
  it("rejects typed fractions inside the actual submit callback before preparation", async () => {
    actualDialog((root) => enter(root, "resultModifier", "1.5"));
    await expect(rollAttribute(actor, "agility")).rejects.toThrow(
      localize("D6E2.Roll.Options.InvalidNumber"),
    );
    untouched();
  });
});
