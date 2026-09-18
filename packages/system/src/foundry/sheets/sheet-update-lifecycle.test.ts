import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../data-models/item-types", () => ({
  CHARACTER_TEMPLATE_ITEM_TYPES: [],
}));

vi.mock("../../settings/campaign-profile", () => ({
  currentSecondEditionCampaignProfile: () => ({ hiddenBases: true }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function setup(type = "weapon") {
  const { document, window } = parseHTML("<html><body></body></html>");
  for (const key of [
    "HTMLElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
  ] as const)
    vi.stubGlobal(key, window[key]);
  const rendered = vi.fn();
  const update = vi.fn(() => {
    rendered();
    return Promise.resolve();
  });
  const actor = {
    id: "owner",
    system: {
      crew: { members: [{ actorId: "pilot" }] },
      members: [{ actorId: "member" }],
    },
    update,
  };
  const item = { type, system: { members: [] }, update };
  class NativeSheet {
    actor = actor;
    item = item;
    isEditable = true;
    element = document.createElement("form");
    _onRender() {
      return Promise.resolve();
    }
    render() {
      rendered();
    }
  }
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        ApplicationV2: NativeSheet,
        HandlebarsApplicationMixin: (base: unknown) => base,
        DialogV2: { wait: () => Promise.resolve(true) },
      },
      sheets: { ItemSheetV2: NativeSheet, ActorSheetV2: NativeSheet },
    },
    utils: { randomID: () => "test-id" },
  });
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key, format: (key: string) => key },
    actors: { get: () => undefined },
    system: { api: { health: { condition: () => update() } } },
  });
  vi.stubGlobal("ui", { notifications: { info: vi.fn() } });
  return { document, window, rendered, update };
}

it.each([
  ["weapon", "system.weaponKind"],
  ["manifestation", "system.designDifficulty"],
])(
  "persists one %s edit across change/blur and repeated sheet bindings",
  async (type, name) => {
    const { window, update, rendered } = setup(type);
    const { D6System2eItemSheet } = await import("./item-sheet");
    const sheet = new D6System2eItemSheet();
    sheet.element.innerHTML = `<div class="d6e2-magic-design"><input name="${name}" value="changed"></div>`;
    await sheet._onRender({}, {});
    await sheet._onRender({}, {});
    const input = sheet.element.querySelector("input");
    assert(input);
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    input.dispatchEvent(new window.Event("focusout", { bubbles: true }));
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ [name]: "changed" });
    expect(rendered).toHaveBeenCalledTimes(1);
    input.dispatchEvent(new window.Event("focusout", { bubbles: true }));
    expect(update).toHaveBeenCalledTimes(1);
  },
);

it("lets the item document update refresh a newly added template member once", async () => {
  const { rendered, update } = setup("item-group");
  const { D6System2eItemSheet } = await import("./item-sheet");
  const sheet = new D6System2eItemSheet();
  await D6System2eItemSheet.DEFAULT_OPTIONS.actions.addTemplateMember.call(
    sheet,
  );
  expect(update).toHaveBeenCalledWith({
    "system.members": [{ label: "", required: true, uuid: "" }],
  });
  expect(rendered).toHaveBeenCalledTimes(1);
});

it("lets the actor update refresh a removed hideout member once", async () => {
  const { document, window, rendered, update } = setup();
  const { D6System2eHideoutSheet } = await import("./hideout-sheet");
  const sheet = new D6System2eHideoutSheet();
  const target = document.createElement("button");
  target.dataset.memberId = "member";
  await D6System2eHideoutSheet.DEFAULT_OPTIONS.actions.removeMember.call(
    sheet,
    new window.Event("click"),
    target,
  );
  expect(update).toHaveBeenCalledWith({ "system.members": [] });
  expect(rendered).toHaveBeenCalledTimes(1);
});

it("lets the machine actor update refresh confirmed crew removal once", async () => {
  const { document, window, rendered, update } = setup();
  const { D6System2eMachineSheet } = await import("./machine-sheet");
  const sheet = new D6System2eMachineSheet();
  const target = document.createElement("button");
  target.dataset.crewActorId = "pilot";
  await D6System2eMachineSheet.DEFAULT_OPTIONS.actions.removeCrew.call(
    sheet,
    new window.Event("click"),
    target,
  );
  expect(update).toHaveBeenCalledWith({ "system.crew.members": [] });
  expect(rendered).toHaveBeenCalledTimes(1);
});

it("does not add a second render after the machine condition service updates its actor", async () => {
  const { document, window, rendered, update } = setup();
  const { D6System2eMachineSheet } = await import("./machine-sheet");
  const sheet = new D6System2eMachineSheet();
  const target = document.createElement("button");
  target.dataset.condition = "wounded";
  await D6System2eMachineSheet.DEFAULT_OPTIONS.actions.setCondition.call(
    sheet,
    new window.Event("click"),
    target,
  );
  expect(update).toHaveBeenCalledTimes(1);
  expect(rendered).toHaveBeenCalledTimes(1);
});
