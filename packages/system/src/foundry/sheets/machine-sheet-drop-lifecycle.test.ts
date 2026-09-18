import { parseHTML } from "linkedom";
import { afterEach, expect, it, vi } from "vitest";

const drop = vi.hoisted(() => {
  const create = vi.fn();
  return {
    create,
    apply: vi.fn(() => {
      create("system");
      return Promise.resolve();
    }),
    canApply: true,
    data: { type: "Item", uuid: "Item.vehicle-gear" },
    item: { id: "vehicle-gear", name: "Repair kit", type: "vehicle-gear" },
  };
});

vi.mock("../actor-item-drop-service", () => ({
  actorItemDropData: () => drop.data,
  itemFromDropData: (data: { type: string }) =>
    Promise.resolve(data.type === "Item" ? drop.item : null),
  previewActorItemDrop: () => ({ canApply: drop.canApply }),
  applyActorItemDrop: drop.apply,
  canTransferActorItem: vi.fn(),
  confirmActorItemTransfer: vi.fn(),
  sortActorItem: vi.fn(),
  transferActorItem: vi.fn(),
}));

afterEach(() => {
  drop.canApply = true;
  drop.data.type = "Item";
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.resetModules();
});

async function setup() {
  const { document, window } = parseHTML("<html><body></body></html>");
  const actor = { id: "vehicle", type: "vehicle" };
  const rendered = vi.fn();
  const nativeDrop = vi.fn();

  // Foundry 14.368 ActorSheetV2._onRender calls DragDrop.bind, which replaces
  // the frame's ondrop property. Its default Item path creates an embedded
  // item independently of any addEventListener handler on that same frame.
  class NativeSheet {
    actor = actor;
    isEditable = true;
    element = document.createElement("form");

    _onRender(): Promise<void> {
      this.element.ondrop = this.isEditable
        ? (event) => {
            event.preventDefault();
            void this._onDrop(event);
          }
        : null;
      return Promise.resolve();
    }

    _onDrop(event: DragEvent): Promise<void> {
      nativeDrop(drop.data.type, event);
      if (drop.data.type === "Item") drop.create("native");
      return Promise.resolve();
    }

    render(): void {
      rendered();
    }

    close(): void {
      this.element.remove();
    }
  }

  vi.stubGlobal("foundry", {
    applications: {
      api: {
        ApplicationV2: NativeSheet,
        HandlebarsApplicationMixin: (base: unknown) => base,
      },
      sheets: { ActorSheetV2: NativeSheet },
    },
  });
  const hook = vi.fn();
  vi.stubGlobal("Hooks", { callAll: hook });
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key, format: (key: string) => key },
  });
  const warn = vi.fn();
  vi.stubGlobal("ui", { notifications: { info: vi.fn(), warn } });

  const { D6System2eMachineSheet } = await import("./machine-sheet");
  const sheet = new D6System2eMachineSheet();
  const lifecycle = sheet as unknown as NativeSheet;
  return {
    document,
    window,
    actor,
    rendered,
    nativeDrop,
    warn,
    hook,
    sheet,
    lifecycle,
  };
}

it("creates one item per drop with native binding, repeated renders and a reopened frame", async () => {
  const {
    document,
    window,
    actor,
    rendered,
    nativeDrop,
    hook,
    sheet,
    lifecycle,
  } = await setup();
  for (let cycle = 0; cycle < 2; cycle += 1) {
    const frame = document.createElement("form");
    lifecycle.element = frame;
    document.body.append(frame);
    for (let render = 0; render < 3; render += 1) {
      await sheet._onRender({ tabs: {} }, {});
    }

    frame.dispatchEvent(new window.Event("drop", { cancelable: true }));
    await vi.waitFor(() => expect(rendered).toHaveBeenCalled());
    expect(drop.create).toHaveBeenCalledExactlyOnceWith("system");
    expect(nativeDrop).not.toHaveBeenCalled();
    expect(drop.apply).toHaveBeenCalledExactlyOnceWith(actor, drop.item);
    expect(hook).toHaveBeenCalledExactlyOnceWith(
      "dropActorSheetData",
      actor,
      sheet,
      drop.data,
    );

    lifecycle.close();
    expect(frame.isConnected).toBe(false);
    drop.apply.mockClear();
    drop.create.mockClear();
    hook.mockClear();
    rendered.mockClear();
  }
});

it("does not let the native Item route bypass a rejected system drop", async () => {
  const { window, sheet, nativeDrop, warn } = await setup();
  drop.canApply = false;
  await sheet._onRender({ tabs: {} }, {});
  sheet.element.dispatchEvent(new window.Event("drop", { cancelable: true }));
  await vi.waitFor(() => expect(warn).toHaveBeenCalled());
  expect(drop.apply).not.toHaveBeenCalled();
  expect(drop.create).not.toHaveBeenCalled();
  expect(nativeDrop).not.toHaveBeenCalled();
});

it("preserves native handling for non-Item document drops", async () => {
  const { window, sheet, nativeDrop } = await setup();
  drop.data.type = "ActiveEffect";
  await sheet._onRender({ tabs: {} }, {});
  const event = new window.Event("drop", { cancelable: true });
  sheet.element.dispatchEvent(event);
  await vi.waitFor(() =>
    expect(nativeDrop).toHaveBeenCalledExactlyOnceWith("ActiveEffect", event),
  );
  expect(drop.apply).not.toHaveBeenCalled();
  expect(drop.create).not.toHaveBeenCalled();
});
