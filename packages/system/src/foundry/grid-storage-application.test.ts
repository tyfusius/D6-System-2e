import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type {
  D6GridStorageApplication,
  refreshRenderedGridStorageActorSheet,
  refreshRenderedGridStorageViews,
} from "./grid-storage-application.js";
import type * as CurrencyHolderService from "./currency-holder-service.js";

const f = vi.hoisted(() => ({
  configuration: vi.fn(),
  movePreview: vi.fn(),
  operation: vi.fn(),
  packPreview: vi.fn(),
  projection: vi.fn(),
  renderTemplate: vi.fn(),
  setCurrency: vi.fn(() => Promise.resolve()),
  dialog: vi.fn(),
  hooks: new Map<string, (...args: unknown[]) => unknown>(),
  hookOff: vi.fn(),
}));

vi.mock("./application-v2-form-options.js", () => ({
  applicationV2FormOptions: (value: unknown) => value,
}));
vi.mock("./grid-storage-authority.js", () => ({
  requestGridStorageConfiguration: f.configuration,
  requestGridStorageMovePreview: f.movePreview,
  requestGridStorageOperation: f.operation,
  requestGridStoragePackPreview: f.packPreview,
  requestGridStorageProjection: f.projection,
}));
vi.mock("./grid-storage-availability.js", () => ({
  requireGridStorageItemAction: vi.fn(),
}));
vi.mock("./medical-consumable-dialog.js", () => ({
  openMedicalConsumableUseDialog: vi.fn(),
}));
vi.mock("./foundry-random-id.js", () => ({
  foundryRandomId: () => "move-operation",
}));
vi.mock("./currency-holder-service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof CurrencyHolderService>()),
  setStorageCurrencyCount: f.setCurrency,
}));

const rootUuid = "Actor.root";
const parent = {
  rootUuid,
  spaceId: "cargo",
  containerInstanceId: null,
  spaceOwnerActorUuid: rootUuid,
} as const;
const otherParent = {
  rootUuid,
  spaceId: "overflow",
  containerInstanceId: null,
  spaceOwnerActorUuid: rootUuid,
} as const;
const storageObject = {
  version: 1,
  definition: {
    version: 1,
    instanceId: "crate",
    physical: {
      version: 1,
      provenance: "preset",
      presetId: "crate",
      widthMm: null,
      depthMm: null,
      heightMm: null,
      unitTareWeightGrams: 10,
      unitExteriorVolumeMillilitres: 10,
      rotatable: true,
      footprintsByScale: {
        personal: { columns: 2, rows: 1, provenance: "preset" },
      },
      stack: { mode: "bounded", maxQuantityPerPlacement: 3 },
    },
  },
  documentUuid: `${rootUuid}.Item.crate`,
  ownerActorUuid: rootUuid,
  quantity: 3,
  witness: "crate-witness",
  location: { state: "unplaced", rootUuid, disposition: "carried" },
};
const space = {
  id: "cargo",
  label: "Cargo hold",
  kind: "cargo",
  ownerActorUuid: rootUuid,
  configuration: "grid",
  access: "open",
  grid: {
    version: 1,
    scaleId: "personal",
    scaleLabel: "Personal",
    columns: 4,
    rows: 3,
    cellWidthMm: 100,
    cellDepthMm: 100,
  },
  limits: {
    maxAggregateWeightGrams: null,
    maxOccupiedVolumeMillilitres: null,
    maxDirectChildren: null,
  },
};

function packedPreview() {
  return {
    version: 1 as const,
    operationId: "move-operation",
    baseRevision: 7,
    outcome: "packed" as const,
    visitedNodes: 1,
    planHash: "pack-plan",
    placements: {
      crate: {
        x: 0,
        y: 0,
        columns: 2,
        rows: 1,
        rotation: "none" as const,
      },
    },
    eligibleInstanceIds: ["crate"],
    excludedInstanceIds: [],
  };
}

function navigationProjection() {
  return {
    workspace: {
      revision: 7,
      spaces: [
        {
          active: true,
          rootUuid,
          spaceId: "cargo",
          containerInstanceId: null,
        },
      ],
      items: [],
      unplaced: [
        {
          instanceId: "crate",
          name: "Parts crate",
          image: "icons/crate.webp",
          quantity: 3,
        },
      ],
    },
    objects: { crate: storageObject },
    destinations: [
      { label: "Root · Cargo hold", parent, space },
      { label: "Root · Overflow", parent: otherParent, space },
    ],
    latestUndo: null,
  };
}

let Application: typeof D6GridStorageApplication;
let refreshActorSheet: typeof refreshRenderedGridStorageActorSheet;
let refreshViews: typeof refreshRenderedGridStorageViews;

class TestInput {
  readonly dataset: Record<string, string> = {};
  constructor(
    readonly name: string,
    readonly value: string,
    readonly type = "text",
    readonly checked = false,
  ) {}

  matches(selector: string): boolean {
    return selector === "[data-holder-currency-count]";
  }
}

class TestSelect {
  constructor(
    readonly name: string,
    readonly value: string,
  ) {}
}

beforeAll(async () => {
  class ApplicationV2 {
    element = { querySelector: () => null, querySelectorAll: () => [] };
    rendered = true;
    render = vi.fn(() => Promise.resolve(this));

    close(): Promise<void> {
      return Promise.resolve();
    }

    _onRender(): Promise<void> {
      return Promise.resolve();
    }
  }
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        ApplicationV2,
        DialogV2: { wait: f.dialog },
        HandlebarsApplicationMixin: (Base: typeof ApplicationV2) => Base,
      },
      handlebars: { renderTemplate: f.renderTemplate },
    },
  });
  vi.stubGlobal("HTMLInputElement", TestInput);
  vi.stubGlobal("HTMLSelectElement", TestSelect);
  vi.stubGlobal("Hooks", {
    on: (hook: string, callback: (...args: unknown[]) => unknown) =>
      f.hooks.set(hook, callback),
    off: (hook: string, callback: (...args: unknown[]) => unknown) => {
      f.hookOff(hook, callback);
      if (f.hooks.get(hook) === callback) f.hooks.delete(hook);
    },
  });
  const module = await import("./grid-storage-application.js");
  Application = module.D6GridStorageApplication;
  refreshActorSheet = module.refreshRenderedGridStorageActorSheet;
  refreshViews = module.refreshRenderedGridStorageViews;
});

beforeEach(() => {
  f.configuration.mockReset();
  f.operation.mockReset().mockResolvedValue({
    version: 1,
    operationId: "move-operation",
    status: "completed",
    projectionToken: null,
  });
  f.packPreview.mockReset();
  f.movePreview.mockReset().mockResolvedValue({
    version: 1,
    operationId: "move-operation",
    baseRevision: 7,
    allowed: true,
    capacity: {
      grid: "available",
      weight: "available",
      volume: "available",
      count: "available",
    },
    planHash: "preview-plan",
    request: {},
  });
  f.dialog.mockReset().mockResolvedValue({
    destinationIndex: 0,
    quantity: 2,
    rotation: "quarter-turn",
    x: 1,
    y: 2,
  });
  f.renderTemplate.mockReset().mockResolvedValue("<preview>ready</preview>");
  f.setCurrency.mockReset().mockResolvedValue(undefined);
  f.hooks.clear();
  f.hookOff.mockClear();
  f.projection.mockReset().mockResolvedValue({
    workspace: {
      revision: 7,
      spaces: [
        {
          active: true,
          rootUuid,
          spaceId: "cargo",
          containerInstanceId: null,
        },
      ],
      items: [],
      unplaced: [{ instanceId: "crate", name: "Parts crate" }],
    },
    objects: { crate: storageObject },
    destinations: [{ label: "Root · Cargo hold", parent, space }],
    latestUndo: null,
  });
  vi.stubGlobal("game", {
    user: { id: "player" },
    i18n: {
      localize: (key: string) => key,
      format: (key: string) => key,
    },
  });
  vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
  vi.stubGlobal(
    "fromUuid",
    vi.fn(() => Promise.resolve(null)),
  );
});

describe("grid storage Application controller", () => {
  it("persists a changed holder count through the native ApplicationV2 form handler", async () => {
    const actor = {
      uuid: rootUuid,
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    const application = new Application(actor);
    const render = vi.spyOn(application, "render");
    const input = new TestInput("holderCurrency.counts.cent", "76");
    Object.assign(input.dataset, {
      denominationId: "cent",
      holderId: "container:qa-kit",
      walletFingerprint: "wallet-before",
    });
    const form = Application.DEFAULT_OPTIONS.form as unknown as {
      handler: (
        this: D6GridStorageApplication,
        event: Event,
        form: HTMLFormElement,
        formData: FoundryFormData,
      ) => Promise<void>;
      submitOnChange: boolean;
    };

    await form.handler.call(
      application,
      { target: input, type: "change" } as unknown as Event,
      {} as HTMLFormElement,
      { object: {} },
    );

    expect(form.submitOnChange).toBe(true);
    expect(f.setCurrency).toHaveBeenCalledWith({
      count: "76",
      denominationId: "cent",
      expectedWalletFingerprint: "wallet-before",
      holderId: "container:qa-kit",
      operationId: "move-operation",
    });
    expect(render).toHaveBeenCalled();
  });

  it("uses the generic currency transfer title for storage holders", () => {
    const implementation = readFileSync(
      "packages/system/src/foundry/grid-storage-application.ts",
      "utf8",
    );
    expect(implementation).toContain(
      'title: game.i18n.localize("D6E2.Economy.TransferCurrency")',
    );
  });

  it("opens an authorized raw owned Item by stable document UUID without a ledger identity", async () => {
    const render = vi.fn();
    const actor = {
      uuid: rootUuid,
      isOwner: true,
      system: { storage: { configured: true } },
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    const rawItem = {
      uuid: `${rootUuid}.Item.raw`,
      type: "gear",
      parent: actor,
      system: { storageInstanceId: "", quantity: 1 },
      sheet: { render },
    } as unknown as FoundryItemDocument;
    vi.stubGlobal(
      "fromUuid",
      vi.fn((uuid: string) =>
        Promise.resolve(uuid === rawItem.uuid ? rawItem : null),
      ),
    );
    const application = new Application(actor);
    const actions = Application.DEFAULT_OPTIONS.actions as Record<
      string,
      (event: Event, target: HTMLElement) => Promise<void> | void
    >;

    await actions.editStorageItemMeasurements?.call(
      application,
      {} as Event,
      {
        dataset: { instanceId: "", documentUuid: rawItem.uuid },
        closest: () => null,
      } as unknown as HTMLElement,
    );

    expect(render).toHaveBeenCalledWith(true);
  });

  it("refreshes only an already-open actor sheet after storage changes", () => {
    const render = vi.fn();
    expect(
      refreshActorSheet({
        sheet: { rendered: true, render },
      } as unknown as FoundryActorDocument),
    ).toBe(true);
    expect(render).toHaveBeenCalledWith(true);

    expect(
      refreshActorSheet({
        sheet: { rendered: false, render },
      } as unknown as FoundryActorDocument),
    ).toBe(false);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("refreshes an already-open actor sheet for a committed remote root without opening a closed sheet", async () => {
    const openRender = vi.fn();
    const closedRender = vi.fn();
    vi.stubGlobal(
      "fromUuid",
      vi.fn((uuid: string) =>
        Promise.resolve(
          uuid === "Actor.open"
            ? {
                uuid,
                sheet: { rendered: true, render: openRender },
              }
            : uuid === "Actor.closed"
              ? {
                  uuid,
                  sheet: { rendered: false, render: closedRender },
                }
              : null,
        ),
      ),
    );

    await refreshViews(["Actor.open", "Actor.closed"]);

    expect(openRender).toHaveBeenCalledWith(true);
    expect(closedRender).not.toHaveBeenCalled();
  });

  it("refreshes an open receiving workspace when its holder wallet updates and unsubscribes on close", async () => {
    const recipient = {
      uuid: "Actor.recipient",
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    const application = new Application(recipient);
    const render = vi.spyOn(application, "render");
    const updateActor = f.hooks.get("updateActor");
    expect(updateActor).toBeTypeOf("function");

    updateActor?.(recipient, {
      "system.currencyWallet": { counts: { cent: "32" } },
    });
    updateActor?.(recipient, { name: "Unrelated change" });
    updateActor?.(
      { uuid: "Actor.other" },
      {
        "system.currencyWallet": { counts: { cent: "99" } },
      },
    );

    expect(render).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledWith(true);

    await application.close();
    expect(f.hookOff).toHaveBeenCalledWith("updateActor", expect.any(Function));
    expect(f.hookOff).toHaveBeenCalledWith("updateItem", expect.any(Function));
    expect(f.hooks.has("updateActor")).toBe(false);
    expect(f.hooks.has("updateItem")).toBe(false);
  });

  it("projects a complete authoritative auto-pack arrangement and hides it when stale", async () => {
    const actor = {
      uuid: rootUuid,
      system: { storage: { configured: true } },
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    const pinnedObject = {
      ...structuredClone(storageObject),
      definition: {
        ...structuredClone(storageObject.definition),
        instanceId: "pinned",
      },
      documentUuid: `${rootUuid}.Item.pinned`,
      witness: "pinned-witness",
      location: {
        state: "placed",
        parent,
        rectangle: {
          x: 2,
          y: 0,
          columns: 1,
          rows: 1,
          rotation: "none",
        },
        disposition: "stored",
        pinned: true,
      },
    };
    const projection = {
      workspace: {
        revision: 7,
        viewMode: "grid",
        gridConfigured: true,
        canViewGrid: true,
        spaces: [
          {
            active: true,
            rootUuid,
            spaceId: "cargo",
            containerInstanceId: null,
          },
        ],
        items: [
          {
            instanceId: "pinned",
            name: "Pinned pouch",
            image: "icons/pinned.webp",
            quantity: 1,
            pinned: true,
          },
        ],
        unplaced: [
          {
            instanceId: "crate",
            name: "Parts crate",
            image: "icons/crate.webp",
            quantity: 3,
          },
        ],
      },
      objects: { crate: storageObject, pinned: pinnedObject },
      destinations: [{ label: "Root · Cargo hold", parent, space }],
      latestUndo: null,
    };
    f.projection.mockResolvedValue(projection);
    f.packPreview.mockResolvedValue({
      version: 1,
      operationId: "move-operation",
      baseRevision: 7,
      outcome: "packed",
      visitedNodes: 3,
      planHash: "pack-plan",
      placements: {
        crate: {
          x: 0,
          y: 0,
          columns: 2,
          rows: 1,
          rotation: "quarter-turn",
        },
        pinned: {
          x: 2,
          y: 0,
          columns: 1,
          rows: 1,
          rotation: "none",
        },
      },
      eligibleInstanceIds: ["crate", "pinned"],
      excludedInstanceIds: [],
    });
    const application = new Application(actor);
    await application._prepareContext();
    const actions = Application.DEFAULT_OPTIONS.actions as Record<
      string,
      (event: Event, target: HTMLElement) => Promise<void> | void
    >;

    await actions.previewAutoPack?.call(
      application,
      {} as Event,
      {} as HTMLElement,
    );
    const ready = await application._prepareContext();
    expect(ready.packPreview).toMatchObject({
      canApply: true,
      stale: false,
      showGridPreview: true,
      pinnedCount: 1,
      previewItems: [
        {
          instanceId: "crate",
          image: "icons/crate.webp",
          quantity: 3,
          pinned: false,
          gridColumnStart: 1,
          gridRowStart: 1,
          gridColumnSpan: 2,
          gridRowSpan: 1,
        },
        {
          instanceId: "pinned",
          pinned: true,
          gridColumnStart: 3,
          gridRowStart: 1,
          gridColumnSpan: 1,
          gridRowSpan: 1,
        },
      ],
    });

    f.projection.mockResolvedValue({
      ...projection,
      workspace: { ...projection.workspace, revision: 8 },
    });
    const stale = await application._prepareContext();
    expect(stale.packPreview).toMatchObject({
      canApply: false,
      stale: true,
      showGridPreview: false,
      previewItems: [],
    });
  });

  it("invalidates a cached auto-pack preview when navigating to another space", async () => {
    const actor = {
      uuid: rootUuid,
      system: { storage: { configured: true } },
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    f.projection.mockResolvedValue(navigationProjection());
    f.packPreview.mockResolvedValue(packedPreview());
    const application = new Application(actor);
    await application._prepareContext();
    const actions = Application.DEFAULT_OPTIONS.actions as Record<
      string,
      (event: Event, target: HTMLElement) => Promise<void> | void
    >;
    await actions.previewAutoPack?.call(
      application,
      {} as Event,
      {} as HTMLElement,
    );
    expect((await application._prepareContext()).packPreview).not.toBeNull();

    await actions.openStorage?.call(
      application,
      {} as Event,
      {
        dataset: {
          rootUuid,
          spaceId: otherParent.spaceId,
          containerInstanceId: "",
        },
      } as unknown as HTMLElement,
    );
    expect((await application._prepareContext()).packPreview).toBeNull();
    await actions.applyAutoPack?.call(
      application,
      {} as Event,
      {} as HTMLElement,
    );
    expect(f.operation).not.toHaveBeenCalled();
  });

  it("discards an auto-pack response that resolves after navigation", async () => {
    const actor = {
      uuid: rootUuid,
      system: { storage: { configured: true } },
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    f.projection.mockResolvedValue(navigationProjection());
    let resolvePreview:
      ((value: ReturnType<typeof packedPreview>) => void) | undefined;
    f.packPreview.mockImplementation(
      () =>
        new Promise<ReturnType<typeof packedPreview>>((resolve) => {
          resolvePreview = resolve;
        }),
    );
    const application = new Application(actor);
    await application._prepareContext();
    const actions = Application.DEFAULT_OPTIONS.actions as Record<
      string,
      (event: Event, target: HTMLElement) => Promise<void> | void
    >;
    const pending = actions.previewAutoPack?.call(
      application,
      {} as Event,
      {} as HTMLElement,
    );

    await actions.openStorage?.call(
      application,
      {} as Event,
      {
        dataset: {
          rootUuid,
          spaceId: otherParent.spaceId,
          containerInstanceId: "",
        },
      } as unknown as HTMLElement,
    );
    resolvePreview?.(packedPreview());
    await pending;

    expect((await application._prepareContext()).packPreview).toBeNull();
  });

  it("previews an exact manual split before applying the identical request", async () => {
    const actor = {
      uuid: rootUuid,
      system: { storage: { configured: true } },
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    const application = new Application(actor);
    await application._prepareContext();
    const actions = Application.DEFAULT_OPTIONS.actions as Record<
      string,
      (event: Event, target: HTMLElement) => Promise<void> | void
    >;
    const target = {
      dataset: { instanceId: "crate" },
      closest: () => null,
    } as unknown as HTMLElement;

    await actions.moveStorageItem?.call(application, {} as Event, target);

    expect(f.movePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: "move-operation",
        baseRevision: 7,
        instanceId: "crate",
        quantity: 2,
        destination: parent,
        rectangle: {
          x: 1,
          y: 2,
          columns: 1,
          rows: 2,
          rotation: "quarter-turn",
        },
        witnesses: { crate: "crate-witness" },
      }),
    );
    expect(f.operation).not.toHaveBeenCalled();

    const previewContext = await application._prepareContext();
    expect(previewContext).toMatchObject({
      movePreview: {
        operationId: "move-operation",
        itemName: "Parts crate",
        quantity: 2,
        canApply: true,
      },
      movePreviewHtml: "<preview>ready</preview>",
    });
    expect(f.renderTemplate).toHaveBeenCalledWith(
      "systems/d6-system-2e/templates/apps/grid-storage-move-preview.hbs",
      expect.objectContaining({ operationId: "move-operation" }),
    );

    await actions.applyStorageMove?.call(
      application,
      {} as Event,
      { dataset: { operationId: "move-operation" } } as unknown as HTMLElement,
    );
    const operationCall = f.operation.mock.calls[0] as unknown as
      | readonly [
          {
            readonly kind: "move";
            readonly value: unknown;
          },
        ]
      | undefined;
    const previewCall = f.movePreview.mock.calls[0] as unknown as
      readonly [unknown] | undefined;
    expect(operationCall?.[0]).toEqual({
      kind: "move",
      value: previewCall?.[0],
    });
  });

  it("serializes the active space editor and sends its exact identity to authority", async () => {
    const actor = {
      uuid: rootUuid,
      system: { storage: { configured: true } },
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    const application = new Application(actor);
    await application._prepareContext();
    const actions = Application.DEFAULT_OPTIONS.actions as Record<
      string,
      (event: Event, target: HTMLElement) => Promise<void> | void
    >;
    const editor = {
      dataset: { spaceId: "cargo" },
      querySelectorAll: () => [
        new TestInput("space.label", "Expanded cargo"),
        new TestSelect("space.configuration", "capacity-only"),
        new TestInput("space.maxDirectChildren", "12", "number"),
      ],
    };
    const target = {
      dataset: {},
      closest: (selector: string) =>
        selector === "[data-d6-storage-space-editor]" ? editor : null,
    } as unknown as HTMLElement;

    await actions.saveStorageConfiguration?.call(
      application,
      {} as Event,
      target,
    );

    expect(f.configuration).toHaveBeenCalledWith({
      kind: "space",
      documentUuid: rootUuid,
      spaceId: "cargo",
      form: {
        label: "Expanded cargo",
        configuration: "capacity-only",
        maxDirectChildren: "12",
      },
    });
  });

  it("normalizes an empty template container attribute when navigating to a root space", async () => {
    const actor = {
      uuid: rootUuid,
      system: { storage: { configured: true } },
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    f.projection.mockResolvedValue({
      workspace: {
        revision: 7,
        spaces: [
          {
            active: true,
            rootUuid,
            spaceId: "inside",
            containerInstanceId: "crate",
          },
        ],
        items: [],
        unplaced: [],
      },
      objects: { crate: storageObject },
      destinations: [
        { label: "Root · Cargo hold", parent, space },
        {
          label: "Crate interior",
          parent: {
            rootUuid,
            spaceId: "inside",
            containerInstanceId: "crate",
            spaceOwnerActorUuid: rootUuid,
          },
          space: { ...space, id: "inside" },
        },
      ],
      latestUndo: null,
    });
    const application = new Application(actor);
    await application._prepareContext();
    const actions = Application.DEFAULT_OPTIONS.actions as Record<
      string,
      (event: Event, target: HTMLElement) => Promise<void> | void
    >;

    await actions.openStorage?.call(
      application,
      {} as Event,
      {
        dataset: {
          rootUuid,
          spaceId: "cargo",
          containerInstanceId: "",
        },
      } as unknown as HTMLElement,
    );
    await application._prepareContext();

    const finalProjectionCall = f.projection.mock.calls.at(-1) as unknown as
      readonly [{ readonly parent?: unknown }] | undefined;
    expect(finalProjectionCall?.[0].parent).toEqual(parent);
  });

  it("previews placement into a capacity-only destination without grid geometry", async () => {
    const actor = {
      uuid: rootUuid,
      system: { storage: { configured: true } },
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    f.projection.mockResolvedValue({
      workspace: {
        revision: 7,
        spaces: [
          {
            active: true,
            rootUuid,
            spaceId: "cargo",
            containerInstanceId: null,
          },
        ],
        items: [],
        unplaced: [{ instanceId: "crate", name: "Parts crate" }],
      },
      objects: { crate: storageObject },
      destinations: [
        {
          label: "Root · Cargo hold",
          parent,
          space: { ...space, configuration: "capacity-only", grid: null },
        },
      ],
      latestUndo: null,
    });
    f.dialog.mockResolvedValue({
      destinationIndex: 0,
      quantity: 3,
      rotation: "none",
      x: 0,
      y: 0,
    });
    const application = new Application(actor);
    await application._prepareContext();
    const actions = Application.DEFAULT_OPTIONS.actions as Record<
      string,
      (event: Event, target: HTMLElement) => Promise<void> | void
    >;

    await actions.moveStorageItem?.call(
      application,
      {} as Event,
      {
        dataset: { instanceId: "crate" },
        closest: () => null,
      } as unknown as HTMLElement,
    );

    expect(f.movePreview).toHaveBeenCalledWith(
      expect.objectContaining({ destination: parent, rectangle: null }),
    );
    const previewContext = await application._prepareContext();
    expect(previewContext).toMatchObject({
      movePreview: {
        coordinateLabel: "D6E2.Storage.CapacityOnly",
        capacityChanges: [{ id: "weight" }, { id: "volume" }, { id: "count" }],
      },
    });
  });

  it("defines every English label used by the manual move dialog", () => {
    const english = JSON.parse(readFileSync("lang/en.json", "utf8")) as Record<
      string,
      string
    >;
    expect(
      [
        "D6E2.Storage.Column",
        "D6E2.Storage.Row",
        "D6E2.Storage.Rotation",
        "D6E2.Storage.RotationNone",
        "D6E2.Storage.RotationQuarterTurn",
        "D6E2.Storage.PreviewMove",
      ].map((key) => english[key]),
    ).toEqual([
      "Column",
      "Row",
      "Rotation",
      "No rotation",
      "Quarter turn",
      "Preview move",
    ]);
  });
});
