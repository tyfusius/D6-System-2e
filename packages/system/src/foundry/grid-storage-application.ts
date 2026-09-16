import {
  currencyInteger,
  storageFootprint,
  type D6StorageCapacityResultV1,
  type D6StorageRotation,
  type D6StorageLocationV1,
  type D6StorageMoveRequestV1,
  type D6StorageObjectV1,
  type D6StoragePackPreviewV1,
  type D6StorageParentV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants.js";
import { applicationV2FormOptions } from "./application-v2-form-options.js";
import { foundryRandomId } from "./foundry-random-id.js";
import {
  requestGridStorageOperation,
  requestGridStorageMovePreview,
  requestGridStoragePackPreview,
  requestGridStorageProjection,
  requestGridStorageConfiguration,
  setGridStorageRefreshHandler,
  type GridStorageClientProjection,
} from "./grid-storage-authority.js";
import { requireGridStorageItemAction } from "./grid-storage-availability.js";
import type {
  D6GridStorageAutoPackVM,
  D6GridStorageCapacityVM,
  D6GridStorageMovePreviewVM,
  D6GridStoragePackPreviewItemVM,
  D6GridStorageSelectionVM,
  D6GridStorageWorkspaceVM,
} from "./grid-storage-view-model.js";
import {
  holderTransferRequest,
  parseCurrencyHolderId,
  setStorageCurrencyCount,
  storageCurrencyFundsContext,
} from "./currency-holder-service.js";
import {
  submitEconomyRequest,
  type EconomyCurrencyHolderTransferRequest,
} from "./economy-service.js";
import { openMedicalConsumableUseDialog } from "./medical-consumable-dialog.js";
import { confirmGridStorageRootRemoval } from "./grid-storage-root-removal.js";
import {
  GRID_STORAGE_ITEM_TYPES,
  gridStorageItemParticipates,
} from "./grid-storage-document-adapter.js";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function changesCurrencyWallet(value: unknown): boolean {
  const changes = record(value);
  if (
    Object.keys(changes).some(
      (key) =>
        key === "system.currencyWallet" ||
        key.startsWith("system.currencyWallet.") ||
        key === "system.profile.currencyWallet" ||
        key.startsWith("system.profile.currencyWallet."),
    )
  )
    return true;
  const system = record(changes.system);
  return (
    Object.hasOwn(system, "currencyWallet") ||
    Object.hasOwn(record(system.profile), "currencyWallet")
  );
}

function formValue(button: FoundryDialogButton, name: string): string {
  const control = button.form?.elements.namedItem(name);
  return control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement
    ? control.value
    : "";
}

function spaceEditorValues(editor: HTMLElement): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const control of Array.from(
    editor.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[name]"),
  )) {
    const key = control.name.startsWith("space.")
      ? control.name.slice("space.".length)
      : control.name;
    result[key] =
      control instanceof HTMLInputElement && control.type === "checkbox"
        ? control.checked
        : control.value;
  }
  return result;
}

function escaped(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

function currentPinned(location: D6StorageLocationV1): boolean {
  return location.state === "unplaced" ? false : location.pinned;
}

function nullableDatasetValue(value: string | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function currentParent(
  location: D6StorageLocationV1,
): D6StorageParentV1 | null {
  return location.state === "unplaced" ? null : location.parent;
}

function sameStorageParent(
  left: D6StorageParentV1 | undefined,
  right: D6StorageParentV1 | undefined,
): boolean {
  return (
    left?.rootUuid === right?.rootUuid &&
    left?.spaceId === right?.spaceId &&
    left?.containerInstanceId === right?.containerInstanceId &&
    left?.spaceOwnerActorUuid === right?.spaceOwnerActorUuid
  );
}

export function refreshRenderedGridStorageActorSheet(
  actor: FoundryActorDocument,
): boolean {
  const sheet = actor.sheet as
    (FoundryDocumentSheet & { readonly rendered?: boolean }) | undefined;
  if (sheet?.rendered !== true) return false;
  sheet.render(true);
  return true;
}

function previewCapacity(
  capacity: D6StorageCapacityResultV1,
  configuration: "capacity-only" | "grid",
): readonly D6GridStorageCapacityVM[] {
  return (
    [
      ["grid", "D6E2.Storage.Grid", capacity.grid],
      ["weight", "D6E2.Storage.Weight", capacity.weight],
      ["volume", "D6E2.Storage.Volume", capacity.volume],
      ["count", "D6E2.Storage.Items", capacity.count],
    ] as const
  )
    .map<D6GridStorageCapacityVM>(([id, label, value]) => {
      const unknown =
        value === "unknown-measurement" || value === "not-configured";
      const available = value === "available";
      return {
        id,
        label: game.i18n.localize(label),
        value: game.i18n.localize(
          unknown
            ? "D6E2.Storage.Unknown"
            : available
              ? "D6E2.Storage.Available"
              : "D6E2.Storage.Exceeded",
        ),
        state: unknown ? "unknown" : available ? "available" : "blocked",
      };
    })
    .filter(({ id }) => configuration === "grid" || id !== "grid");
}

export async function promptGridStorageConfiguration(
  actor: FoundryActorDocument & { readonly uuid: string },
): Promise<boolean> {
  const result = await foundry.applications.api.DialogV2.wait<Record<
    string,
    unknown
  > | null>({
    classes: ["d6e2", "d6e2-grid-storage-editor"],
    content: `<label>${game.i18n.localize("D6E2.Storage.SpaceName")}<input name="label" value="${game.i18n.localize("D6E2.Storage.Storage")}"></label><label>${game.i18n.localize("D6E2.Storage.Columns")}<input type="number" min="1" name="columns" value="4"></label><label>${game.i18n.localize("D6E2.Storage.Rows")}<input type="number" min="1" name="rows" value="3"></label><input type="hidden" name="configuration" value="grid"><input type="hidden" name="scalePresetId" value="personal-100">`,
    modal: true,
    position: { width: 440 },
    rejectClose: false,
    window: { title: game.i18n.localize("D6E2.Storage.ConfigureSpace") },
    buttons: [
      {
        action: "cancel",
        label: game.i18n.localize("D6E2.Cancel"),
        callback: () => null,
      },
      {
        action: "save",
        default: true,
        label: game.i18n.localize("D6E2.Storage.SaveConfiguration"),
        callback: (_event, button) => ({
          label: formValue(button, "label"),
          columns: formValue(button, "columns"),
          rows: formValue(button, "rows"),
          configuration: "grid",
          scalePresetId: "personal-100",
        }),
      },
    ],
  });
  if (!result) return false;
  await requestGridStorageConfiguration({
    kind: "root",
    documentUuid: actor.uuid,
    form: result,
    spaceId: "primary",
  });
  return true;
}

export class D6GridStorageApplication extends Base {
  static override PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/apps/grid-storage-workspace.hbs`,
    },
  };

  readonly #actor: FoundryActorDocument & { readonly uuid: string };
  #parent: D6StorageParentV1 | undefined;
  #selected = "";
  #viewMode: "grid" | "list" | undefined;
  #packPreview:
    | {
        readonly parent: D6StorageParentV1;
        readonly value: D6StoragePackPreviewV1;
      }
    | undefined;
  #packRequestEpoch = 0;
  #movePreview:
    | {
        readonly request: D6StorageMoveRequestV1;
        readonly view: D6GridStorageMovePreviewVM;
      }
    | undefined;
  #projection: GridStorageClientProjection | null = null;
  readonly #refreshActorCurrency = (
    document: unknown,
    changes: unknown,
  ): void => {
    const actor = document as { readonly uuid?: string };
    if (actor.uuid === this.#actor.uuid && changesCurrencyWallet(changes))
      this.render(true);
  };
  readonly #refreshItemCurrency = (
    document: unknown,
    changes: unknown,
  ): void => {
    const item = document as { readonly uuid?: string };
    if (
      item.uuid &&
      changesCurrencyWallet(changes) &&
      Object.values(this.#projection?.objects ?? {}).some(
        ({ documentUuid }) => documentUuid === item.uuid,
      )
    )
      this.render(true);
  };

  constructor(
    actor: FoundryActorDocument & { readonly uuid: string },
    parent?: D6StorageParentV1,
  ) {
    super();
    this.#actor = actor;
    this.#parent = parent;
    Hooks.on("updateActor", this.#refreshActorCurrency);
    Hooks.on("updateItem", this.#refreshItemCurrency);
  }

  override async close(): Promise<void> {
    Hooks.off("updateActor", this.#refreshActorCurrency);
    Hooks.off("updateItem", this.#refreshItemCurrency);
    if (applications.get(this.#actor.uuid) === this)
      applications.delete(this.#actor.uuid);
    await super.close();
  }

  #object(instanceId: string): Promise<D6StorageObjectV1 | undefined> {
    return Promise.resolve(this.#projection?.objects[instanceId]);
  }

  #clearPackPreview(): void {
    this.#packRequestEpoch += 1;
    this.#packPreview = undefined;
  }

  async #requestMove(
    object: D6StorageObjectV1,
    changes: {
      readonly destination?: D6StorageParentV1 | null;
      readonly rectangle?: D6StorageMoveRequestV1["rectangle"];
      readonly disposition?: D6StorageMoveRequestV1["disposition"];
      readonly pinned?: boolean;
      readonly quantity?: number | "all";
    },
  ): Promise<void> {
    const request = this.#moveRequest(object, changes);
    if (!request) return;
    await this.#applyMove(request);
  }

  #moveRequest(
    object: D6StorageObjectV1,
    changes: {
      readonly destination?: D6StorageParentV1 | null;
      readonly rectangle?: D6StorageMoveRequestV1["rectangle"];
      readonly disposition?: D6StorageMoveRequestV1["disposition"];
      readonly pinned?: boolean;
      readonly quantity?: number | "all";
    },
  ): D6StorageMoveRequestV1 | null {
    const revision = this.#projection?.workspace?.revision;
    if (revision === null || revision === undefined) return null;
    const destination =
      changes.destination === undefined
        ? currentParent(object.location)
        : changes.destination;
    const rectangle =
      changes.rectangle === undefined
        ? object.location.state === "placed"
          ? object.location.rectangle
          : null
        : changes.rectangle;
    return {
      version: 1,
      operationId: foundryRandomId(),
      baseRevision: revision,
      instanceId: object.definition.instanceId,
      quantity: changes.quantity ?? "all",
      destination,
      rectangle,
      disposition: changes.disposition ?? object.location.disposition,
      pinned: changes.pinned ?? currentPinned(object.location),
      ownershipTransfer: {
        mode: "preserve",
        targetOwnerActorUuid: null,
        scope: "object-only",
      },
      witnesses: { [object.definition.instanceId]: object.witness },
    };
  }

  async #applyMove(request: D6StorageMoveRequestV1): Promise<void> {
    const result = await requestGridStorageOperation({
      kind: "move",
      value: request,
    });
    if (result.status === "completed")
      refreshRenderedGridStorageActorSheet(this.#actor);
    if (result.status !== "completed")
      ui.notifications.warn(
        game.i18n.localize(
          result.issue === "stale"
            ? "D6E2.Storage.Error.Stale"
            : "D6E2.Storage.Error.DestinationUnavailable",
        ),
      );
    this.#clearPackPreview();
    this.#movePreview = undefined;
    this.render();
  }

  override async _prepareContext(): Promise<Record<string, unknown>> {
    this.#projection = await requestGridStorageProjection({
      actorUuid: this.#actor.uuid,
      ...(this.#parent ? { parent: this.#parent } : {}),
      ...(this.#viewMode ? { viewMode: this.#viewMode } : {}),
    });
    const workspace = this.#projection.workspace;
    if (!workspace) return {};
    const activeSpace = workspace.spaces.find(({ active }) => active);
    if (!this.#parent && activeSpace)
      this.#parent = {
        rootUuid: activeSpace.rootUuid,
        spaceId: activeSpace.spaceId,
        containerInstanceId: activeSpace.containerInstanceId,
        spaceOwnerActorUuid: activeSpace.rootUuid,
      };
    const fundsContext = await storageCurrencyFundsContext(
      this.#actor,
      this.#projection,
      this.#parent?.containerInstanceId ?? null,
    );
    const selected = workspace.items.find(
      ({ instanceId }) => instanceId === this.#selected,
    );
    const selection: D6GridStorageSelectionVM | null = selected
      ? {
          instanceId: selected.instanceId,
          title: selected.name,
          placementLabel: selected.accessibleLabel,
          measurementLabel: selected.listed
            ? game.i18n.localize("D6E2.Storage.CapacityOnly")
            : `${selected.columns} × ${selected.rows}`,
          pinned: selected.pinned,
          canMove: selected.canMove,
          canPin: selected.canPin,
          canRotate: selected.canRotate,
          canOpen: selected.canOpen,
          canConfigure: selected.canConfigure,
          canUse: selected.canUse,
          canEquip: selected.canEquip,
          canUnequip: selected.canUnequip,
          equipLabel: selected.equipLabel,
        }
      : null;
    const movePreview = this.#movePreview?.view ?? null;
    const movePreviewHtml = movePreview
      ? await foundry.applications.handlebars.renderTemplate(
          `systems/${SYSTEM_ID}/templates/apps/grid-storage-move-preview.hbs`,
          movePreview as unknown as Record<string, unknown>,
        )
      : "";
    return {
      ...workspace,
      ...fundsContext,
      selection,
      packPreview:
        this.#packPreview &&
        sameStorageParent(this.#packPreview.parent, this.#parent)
          ? this.#packView(this.#packPreview.value, workspace)
          : null,
      movePreview,
      movePreviewHtml,
    };
  }

  #packView(
    preview: D6StoragePackPreviewV1,
    workspace: D6GridStorageWorkspaceVM,
  ): D6GridStorageAutoPackVM {
    const itemMetadata = new Map(
      [...workspace.items, ...workspace.unplaced].map((item) => [
        item.instanceId,
        item,
      ]),
    );
    const placementEntries = Object.entries(preview.placements);
    const proposedItems = placementEntries.flatMap(
      ([instanceId, rectangle]): readonly D6GridStoragePackPreviewItemVM[] => {
        const item = itemMetadata.get(instanceId);
        if (!item) return [];
        const pinned = "pinned" in item && item.pinned;
        return [
          {
            instanceId,
            name: item.name,
            image: item.image,
            quantity: item.quantity,
            pinned,
            accessibleLabel: `${item.name}, ${rectangle.columns} × ${rectangle.rows}, ${rectangle.x + 1}, ${rectangle.y + 1}`,
            gridColumnStart: rectangle.x + 1,
            gridRowStart: rectangle.y + 1,
            gridColumnSpan: rectangle.columns,
            gridRowSpan: rectangle.rows,
          },
        ];
      },
    );
    const stale = workspace.revision !== preview.baseRevision;
    const canApply = preview.outcome === "packed" && !stale;
    const showGridPreview =
      canApply &&
      workspace.viewMode === "grid" &&
      workspace.gridConfigured === true &&
      workspace.canViewGrid &&
      proposedItems.length === placementEntries.length;
    return {
      fixtureId: "live-auto-pack",
      outcome: preview.outcome,
      title: game.i18n.localize("D6E2.Storage.AutoPack"),
      summary: game.i18n.localize(
        preview.outcome === "packed"
          ? "D6E2.Storage.AutoPackReady"
          : preview.outcome === "proven-impossible"
            ? "D6E2.Storage.AutoPackImpossible"
            : "D6E2.Storage.AutoPackLimited",
      ),
      visitedNodes: preview.visitedNodes,
      pinnedCount: proposedItems.filter(({ pinned }) => pinned).length,
      eligibleCount: preview.eligibleInstanceIds.length,
      excludedCount: preview.excludedInstanceIds.length,
      excludedSummary: preview.excludedInstanceIds.length
        ? game.i18n.format("D6E2.Storage.AutoPackExcluded", {
            count: preview.excludedInstanceIds.length,
          })
        : "",
      moves: Object.entries(preview.placements).map(
        ([instanceId, rectangle]) => ({
          instanceId,
          name:
            itemMetadata.get(instanceId)?.name ??
            game.i18n.localize("D6E2.Storage.UnknownItem"),
          fromLabel: game.i18n.localize("D6E2.Storage.CurrentPosition"),
          toLabel: `${rectangle.x + 1}, ${rectangle.y + 1}`,
        }),
      ),
      showGridPreview,
      previewItems: showGridPreview ? proposedItems : [],
      canApply,
      canUndo: false,
      stale,
    };
  }

  static #instanceId(target: HTMLElement): string {
    return (
      target.dataset.instanceId ??
      target.closest<HTMLElement>("[data-instance-id]")?.dataset.instanceId ??
      ""
    );
  }

  static readonly #openStorage = function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): void {
    const rootUuid = target.dataset.rootUuid;
    const spaceId = target.dataset.spaceId;
    const containerInstanceId = nullableDatasetValue(
      target.dataset.containerInstanceId,
    );
    const destination = this.#projection?.destinations.find(
      ({ parent }) =>
        parent.rootUuid === rootUuid &&
        parent.spaceId === spaceId &&
        parent.containerInstanceId === containerInstanceId,
    );
    if (destination && !sameStorageParent(this.#parent, destination.parent)) {
      this.#parent = destination.parent;
      this.#clearPackPreview();
    }
    this.#selected = "";
    this.render();
  };

  static readonly #transferStorageFunds = async function (
    this: D6GridStorageApplication,
  ): Promise<void> {
    const projection = this.#projection;
    if (!projection) return;
    const context = await storageCurrencyFundsContext(
      this.#actor,
      projection,
      this.#parent?.containerInstanceId ?? null,
    );
    const funds = context.funds;
    const firstDestination = context.fundDestinations[0];
    const firstDenomination = funds?.denominations[0];
    if (!funds?.canTransfer || !firstDestination || !firstDenomination) return;
    const sourceHolder = context.sourceHolder;
    if (!sourceHolder) return;
    const destinations = new Map(
      context.fundDestinations.map((destination) => [
        destination.holderId,
        destination,
      ]),
    );
    const content = await foundry.applications.handlebars.renderTemplate(
      `systems/${SYSTEM_ID}/templates/apps/grid-storage-currency-transfer.hbs`,
      {
        ...context,
        selectedDenominationId: firstDenomination.id,
        selectedTargetHolderId: firstDestination.holderId,
        sourceCount: firstDenomination.count,
      },
    );
    const result =
      await foundry.applications.api.DialogV2.wait<EconomyCurrencyHolderTransferRequest | null>(
        {
          buttons: [
            {
              action: "cancel",
              callback: () => null,
              label: game.i18n.localize("D6E2.Cancel"),
            },
            {
              action: "transfer",
              class: "od6roll-submit",
              default: true,
              icon: "fa-solid fa-arrow-right-arrow-left",
              label: game.i18n.localize("D6E2.Economy.TransferCurrency"),
              callback: (_event, button) => {
                const targetHolderId = formValue(button, "targetHolderId");
                const denominationId = formValue(button, "denominationId");
                const amount = formValue(button, "amount");
                try {
                  currencyInteger(amount, { positive: true });
                  const target = destinations.get(targetHolderId);
                  if (!target) return null;
                  return {
                    holderTransfer: holderTransferRequest({
                      amount,
                      denominationId,
                      source: sourceHolder,
                      target: parseCurrencyHolderId(target.holderId),
                    }),
                    sourceActorId: sourceHolder.ownerRoot.id,
                    targetActorId: target.ownerActorId,
                    type: "currency-holder-transfer",
                  };
                } catch {
                  return null;
                }
              },
            },
          ],
          classes: ["d6e2", "od6roll-dialog", "d6e2-economy-dialog"],
          content,
          modal: true,
          position: { width: 520 },
          rejectClose: false,
          render: (_event, dialog) => {
            const root = (
              dialog as unknown as { readonly element?: HTMLElement }
            ).element;
            if (!root) return;
            const updateSourceCount = (): void => {
              const denominationId =
                root.querySelector<HTMLSelectElement>("[name=denominationId]")
                  ?.value ?? "";
              const count =
                funds.denominations.find(({ id }) => id === denominationId)
                  ?.count ?? "0";
              const output = root.querySelector<HTMLElement>(
                "[data-holder-currency-source-count]",
              );
              if (output) output.textContent = count;
            };
            root
              .querySelector("[name=denominationId]")
              ?.addEventListener("change", updateSourceCount);
            updateSourceCount();
          },
          window: {
            icon: "fa-solid fa-arrow-right-arrow-left",
            title: game.i18n.localize("D6E2.Economy.TransferCurrency"),
          },
        },
      );
    if (!result) return;
    try {
      await submitEconomyRequest(result);
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error
            ? error.message
            : "D6E2.Economy.Error.TransactionFailed",
        ),
      );
    }
  };

  static readonly #submitStorageForm = async function (
    this: D6GridStorageApplication,
    event: Event,
  ): Promise<void> {
    if (event.type !== "change") return;
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) ||
      !input.matches("[data-holder-currency-count]")
    )
      return;
    try {
      await setStorageCurrencyCount({
        count: input.value,
        denominationId: input.dataset.denominationId ?? "",
        expectedWalletFingerprint: input.dataset.walletFingerprint ?? "",
        holderId: input.dataset.holderId ?? "",
        operationId: foundryRandomId(),
      });
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error
            ? error.message
            : "D6E2.Economy.Error.TransactionFailed",
        ),
      );
    }
    this.render();
  };

  static readonly #selectStorageItem = function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): void {
    this.#selected =
      this.#selected === D6GridStorageApplication.#instanceId(target)
        ? ""
        : D6GridStorageApplication.#instanceId(target);
    this.render();
  };

  static readonly #setStorageViewMode = function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): void {
    this.#viewMode = target.dataset.viewMode === "list" ? "list" : "grid";
    this.render();
  };

  static readonly #rotateStorageItem = async function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const object = await this.#object(
      D6GridStorageApplication.#instanceId(target),
    );
    if (object?.location.state !== "placed") return;
    const rectangle = object.location.rectangle;
    await this.#requestMove(object, {
      rectangle: {
        ...rectangle,
        columns: rectangle.rows,
        rows: rectangle.columns,
        rotation: rectangle.rotation === "none" ? "quarter-turn" : "none",
      },
    });
  };

  static readonly #toggleStoragePin = async function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const object = await this.#object(
      D6GridStorageApplication.#instanceId(target),
    );
    if (!object || object.location.state === "unplaced") return;
    await this.#requestMove(object, { pinned: !object.location.pinned });
  };

  static readonly #openStorageContainer = async function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const object = await this.#object(
      D6GridStorageApplication.#instanceId(target),
    );
    const interior = object?.definition.interior;
    if (!object || !interior) return;
    const parent = {
      rootUuid:
        object.location.state === "unplaced"
          ? object.location.rootUuid
          : object.location.parent.rootUuid,
      spaceId: interior.id,
      containerInstanceId: object.definition.instanceId,
      spaceOwnerActorUuid: interior.ownerActorUuid,
    };
    if (!sameStorageParent(this.#parent, parent)) {
      this.#parent = parent;
      this.#clearPackPreview();
    }
    this.#selected = "";
    this.render();
  };

  static readonly #moveStorageItem = async function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const object = await this.#object(
      D6GridStorageApplication.#instanceId(target),
    );
    if (!object || !this.#parent) return;
    const currentParent = this.#parent;
    const destinations = this.#projection?.destinations ?? [];
    if (destinations.length === 0) return;
    const selectedIndex = Math.max(
      0,
      destinations.findIndex(
        ({ parent }) =>
          parent.rootUuid === currentParent.rootUuid &&
          parent.spaceId === currentParent.spaceId &&
          parent.containerInstanceId === currentParent.containerInstanceId,
      ),
    );
    const result = await foundry.applications.api.DialogV2.wait<{
      readonly destinationIndex: number;
      readonly quantity: number;
      readonly rotation: D6StorageRotation;
      readonly x: number;
      readonly y: number;
    } | null>({
      classes: ["d6e2", "d6e2-grid-storage-move"],
      content: `<label>${game.i18n.localize("D6E2.Storage.Destination")}<select name="destination">${destinations
        .map(
          ({ label }, index) =>
            `<option value="${index}"${index === selectedIndex ? " selected" : ""}>${escaped(label)}</option>`,
        )
        .join(
          "",
        )}</select></label><label>${game.i18n.localize("D6E2.Storage.Quantity")}<input name="quantity" type="number" min="1" max="${object.quantity}" value="${object.quantity}"></label><label>${game.i18n.localize("D6E2.Storage.Column")}<input name="x" type="number" min="1" value="1"></label><label>${game.i18n.localize("D6E2.Storage.Row")}<input name="y" type="number" min="1" value="1"></label><label>${game.i18n.localize("D6E2.Storage.Rotation")}<select name="rotation"><option value="none">${game.i18n.localize("D6E2.Storage.RotationNone")}</option><option value="quarter-turn">${game.i18n.localize("D6E2.Storage.RotationQuarterTurn")}</option></select></label>`,
      modal: true,
      position: { width: 520 },
      rejectClose: false,
      window: { title: game.i18n.localize("D6E2.Storage.MoveTo") },
      buttons: [
        {
          action: "cancel",
          label: game.i18n.localize("D6E2.Cancel"),
          callback: () => null,
        },
        {
          action: "preview",
          default: true,
          label: game.i18n.localize("D6E2.Storage.PreviewMove"),
          callback: (_dialogEvent, button) => ({
            destinationIndex: Number(formValue(button, "destination")),
            quantity: Number(formValue(button, "quantity")),
            rotation:
              formValue(button, "rotation") === "quarter-turn"
                ? "quarter-turn"
                : "none",
            x: Number(formValue(button, "x")) - 1,
            y: Number(formValue(button, "y")) - 1,
          }),
        },
      ],
    });
    if (!result) return;
    const destination = destinations[result.destinationIndex];
    if (
      !destination ||
      !Number.isSafeInteger(result.quantity) ||
      result.quantity < 1 ||
      result.quantity > object.quantity
    )
      throw new Error("D6E2.Storage.Error.InvalidQuantity");
    const footprint = destination.space.grid
      ? storageFootprint(
          object.definition.physical,
          destination.space.grid,
          result.rotation,
        )
      : null;
    if (destination.space.configuration === "grid" && !footprint)
      throw new Error("D6E2.Storage.Error.DestinationUnavailable");
    const request = this.#moveRequest(object, {
      destination: destination.parent,
      rectangle: footprint
        ? {
            x: result.x,
            y: result.y,
            columns: footprint.columns,
            rows: footprint.rows,
            rotation: result.rotation,
          }
        : null,
      quantity: result.quantity === object.quantity ? "all" : result.quantity,
    });
    if (!request) return;
    const preview = await requestGridStorageMovePreview(request);
    const itemName = [
      ...(this.#projection?.workspace?.items ?? []),
      ...(this.#projection?.workspace?.unplaced ?? []),
    ].find(
      ({ instanceId }) => instanceId === object.definition.instanceId,
    )?.name;
    this.#movePreview = {
      request,
      view: {
        operationId: preview.operationId,
        itemName: itemName ?? game.i18n.localize("D6E2.Storage.UnknownItem"),
        quantity: result.quantity,
        destinationLabel: destination.label,
        coordinateLabel: footprint
          ? `${result.x + 1}, ${result.y + 1} · ${footprint.columns} × ${footprint.rows}`
          : game.i18n.localize("D6E2.Storage.CapacityOnly"),
        allowed: preview.allowed,
        issue: preview.allowed
          ? ""
          : game.i18n.localize(
              preview.issue === "stale"
                ? "D6E2.Storage.Error.Stale"
                : "D6E2.Storage.Error.DestinationUnavailable",
            ),
        capacityChanges: previewCapacity(
          preview.capacity,
          destination.space.configuration === "capacity-only"
            ? "capacity-only"
            : "grid",
        ),
        canApply: preview.allowed,
        applyAction: "applyStorageMove",
        cancelAction: "cancelStorageMove",
        stale: preview.issue === "stale",
      },
    };
    this.render();
  };

  static readonly #applyStorageMove = async function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const preview = this.#movePreview;
    if (
      !preview ||
      !preview.view.canApply ||
      target.dataset.operationId !== preview.request.operationId
    )
      return;
    await this.#applyMove(preview.request);
  };

  static readonly #cancelStorageMove = function (
    this: D6GridStorageApplication,
  ): void {
    this.#movePreview = undefined;
    this.render();
  };

  static readonly #previewAutoPack = async function (
    this: D6GridStorageApplication,
  ): Promise<void> {
    if (!this.#parent || !game.user) return;
    const parent = structuredClone(this.#parent);
    const requestEpoch = this.#packRequestEpoch + 1;
    this.#packRequestEpoch = requestEpoch;
    this.#packPreview = undefined;
    const witnesses = Object.fromEntries(
      Object.values(this.#projection?.objects ?? {})
        .filter((object) =>
          object.location.state === "unplaced"
            ? object.location.rootUuid === this.#parent?.rootUuid
            : object.location.parent.rootUuid === this.#parent?.rootUuid,
        )
        .map((object) => [object.definition.instanceId, object.witness]),
    );
    const revision = this.#projection?.workspace?.revision;
    if (revision === null || revision === undefined) return;
    const preview = await requestGridStoragePackPreview({
      version: 1,
      operationId: foundryRandomId(),
      baseRevision: revision,
      parent,
      maxSearchNodes: 50_000,
      witnesses,
    });
    if (
      requestEpoch !== this.#packRequestEpoch ||
      !sameStorageParent(this.#parent, parent)
    )
      return;
    this.#packPreview = { parent, value: preview };
    this.render();
  };

  static readonly #applyAutoPack = async function (
    this: D6GridStorageApplication,
  ): Promise<void> {
    const cached = this.#packPreview;
    if (
      !this.#parent ||
      !cached ||
      !sameStorageParent(this.#parent, cached.parent)
    )
      return;
    const witnesses = Object.fromEntries(
      Object.entries(this.#projection?.objects ?? {})
        .filter(([, object]) =>
          object.location.state === "unplaced"
            ? object.location.rootUuid === this.#parent?.rootUuid
            : object.location.parent.rootUuid === this.#parent?.rootUuid,
        )
        .map(([id, object]) => [id, object.witness]),
    );
    const result = await requestGridStorageOperation({
      kind: "auto-pack",
      value: {
        version: 1,
        operationId: cached.value.operationId,
        baseRevision: cached.value.baseRevision,
        parent: this.#parent,
        planHash: cached.value.planHash,
        witnesses,
      },
    });
    if (result.status === "completed")
      refreshRenderedGridStorageActorSheet(this.#actor);
    this.#clearPackPreview();
    this.render();
  };

  static readonly #cancelAutoPack = function (
    this: D6GridStorageApplication,
  ): void {
    this.#clearPackPreview();
    this.render();
  };

  static readonly #undoStorageOperation = async function (
    this: D6GridStorageApplication,
  ): Promise<void> {
    const target = this.#projection?.latestUndo;
    if (!target) return;
    const witnesses = Object.fromEntries(
      target.instanceIds.map((id) => [
        id,
        this.#projection?.objects[id]?.witness ?? "",
      ]),
    );
    const result = await requestGridStorageOperation({
      kind: "undo",
      value: {
        version: 1,
        operationId: foundryRandomId(),
        targetOperationId: target.operationId,
        baseRevision: target.afterRevision,
        witnesses,
      },
    });
    if (result.status === "completed")
      refreshRenderedGridStorageActorSheet(this.#actor);
    this.render();
  };

  static readonly #useItem = async function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const object = await this.#object(
      D6GridStorageApplication.#instanceId(target),
    );
    if (!object) return;
    const item = (await fromUuid(
      object.documentUuid,
    )) as FoundryItemDocument | null;
    if (!item) return;
    await requireGridStorageItemAction(item, object.ownerActorUuid, "use");
    if (
      item.type === "gear" &&
      item.system.gearCategory === "medical-consumable"
    )
      openMedicalConsumableUseDialog(item);
    else item.sheet.render(true);
  };

  static readonly #toggleEquipped = async function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const object = await this.#object(
      D6GridStorageApplication.#instanceId(target),
    );
    if (!object) return;
    const item = (await fromUuid(
      object.documentUuid,
    )) as FoundryItemDocument | null;
    if (!item) return;
    if (object.location.disposition !== "equipped")
      await requireGridStorageItemAction(item, object.ownerActorUuid, "equip");
    await this.#requestMove(object, {
      destination:
        object.location.state === "unplaced" ? null : object.location.parent,
      rectangle:
        object.location.state === "placed" ? object.location.rectangle : null,
      disposition:
        object.location.disposition === "equipped" ? "carried" : "equipped",
      pinned: currentPinned(object.location),
    });
  };

  static readonly #configureStorage = function (
    this: D6GridStorageApplication,
  ): void {
    const editor = this.element.querySelector<HTMLElement>(
      "[data-d6-storage-space-editor]",
    );
    editor?.scrollIntoView({ block: "nearest" });
    editor?.querySelector<HTMLElement>("input, select, button")?.focus();
  };

  static readonly #editStorageItemMeasurements = async function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const instanceId = D6GridStorageApplication.#instanceId(target);
    if (instanceId) {
      const object = await this.#object(instanceId);
      if (!object) return;
      const item = (await fromUuid(
        object.documentUuid,
      )) as FoundryItemDocument | null;
      item?.sheet.render(true);
      return;
    }
    const documentUuid = nullableDatasetValue(target.dataset.documentUuid);
    if (
      !documentUuid ||
      (this.#actor.isOwner !== true && game.user?.isGM !== true)
    )
      return;
    const item = (await fromUuid(documentUuid)) as FoundryItemDocument | null;
    if (
      item?.uuid !== documentUuid ||
      item.parent?.uuid !== this.#actor.uuid ||
      !GRID_STORAGE_ITEM_TYPES.includes(
        item.type as (typeof GRID_STORAGE_ITEM_TYPES)[number],
      ) ||
      gridStorageItemParticipates(item)
    )
      return;
    item.sheet.render(true);
  };

  static readonly #saveStorageConfiguration = async function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const editor = target.closest<HTMLElement>(
      "[data-d6-storage-space-editor]",
    );
    if (!editor) return;
    await requestGridStorageConfiguration({
      kind: "space",
      documentUuid: this.#actor.uuid,
      form: spaceEditorValues(editor),
      spaceId: editor.dataset.spaceId ?? target.dataset.spaceId ?? "primary",
      ...(this.#parent?.containerInstanceId
        ? { containerInstanceId: this.#parent.containerInstanceId }
        : {}),
    });
    refreshRenderedGridStorageActorSheet(this.#actor);
    this.render();
  };

  static readonly #removeStorageRoot = async function (
    this: D6GridStorageApplication,
  ): Promise<void> {
    if (!(await confirmGridStorageRootRemoval(this.#actor))) return;
    refreshRenderedGridStorageActorSheet(this.#actor);
    await this.close();
  };

  static readonly #unpackStorageContainer = async function (
    this: D6GridStorageApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const object = await this.#object(
      D6GridStorageApplication.#instanceId(target),
    );
    if (!object || !this.#parent) return;
    const revision = this.#projection?.workspace?.revision;
    if (revision === null || revision === undefined) return;
    const result = await requestGridStorageOperation({
      kind: "unpack",
      value: {
        version: 1,
        operationId: foundryRandomId(),
        baseRevision: revision,
        containerInstanceId: object.definition.instanceId,
        destination: this.#parent,
        witnesses: { [object.definition.instanceId]: object.witness },
      },
    });
    if (result.status === "completed")
      refreshRenderedGridStorageActorSheet(this.#actor);
    this.render();
  };

  static override DEFAULT_OPTIONS = {
    id: "d6-grid-storage",
    tag: "form",
    classes: ["d6e2", "d6e2-grid-storage"],
    position: { width: 980, height: 720 },
    window: { title: "D6E2.Storage.Storage", resizable: true },
    form: applicationV2FormOptions({
      handler: this.#submitStorageForm,
      submitOnChange: true,
      closeOnSubmit: false,
    }),
    actions: {
      openStorage: D6GridStorageApplication.#openStorage,
      selectStorageItem: D6GridStorageApplication.#selectStorageItem,
      setStorageViewMode: D6GridStorageApplication.#setStorageViewMode,
      rotateStorageItem: D6GridStorageApplication.#rotateStorageItem,
      toggleStoragePin: D6GridStorageApplication.#toggleStoragePin,
      openStorageContainer: D6GridStorageApplication.#openStorageContainer,
      moveStorageItem: D6GridStorageApplication.#moveStorageItem,
      placeUnplacedStorageItem: D6GridStorageApplication.#moveStorageItem,
      applyStorageMove: D6GridStorageApplication.#applyStorageMove,
      cancelStorageMove: D6GridStorageApplication.#cancelStorageMove,
      previewAutoPack: D6GridStorageApplication.#previewAutoPack,
      applyAutoPack: D6GridStorageApplication.#applyAutoPack,
      cancelAutoPack: D6GridStorageApplication.#cancelAutoPack,
      undoStorageOperation: D6GridStorageApplication.#undoStorageOperation,
      useItem: D6GridStorageApplication.#useItem,
      toggleEquipped: D6GridStorageApplication.#toggleEquipped,
      configureStorage: D6GridStorageApplication.#configureStorage,
      editStorageItemMeasurements:
        D6GridStorageApplication.#editStorageItemMeasurements,
      saveStorageConfiguration:
        D6GridStorageApplication.#saveStorageConfiguration,
      removeStorageRoot: D6GridStorageApplication.#removeStorageRoot,
      unpackStorageContainer: D6GridStorageApplication.#unpackStorageContainer,
      transferStorageFunds: D6GridStorageApplication.#transferStorageFunds,
    },
  };

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    const grid = this.element.querySelector<HTMLElement>(
      "[data-d6-storage-grid]",
    );
    grid?.addEventListener("dragover", (event) => event.preventDefault());
    grid?.addEventListener("drop", (event) => {
      event.preventDefault();
      const dragged = this.element.querySelector<HTMLElement>(
        "[data-d6-storage-dragging]",
      );
      const instanceId = dragged?.dataset.instanceId;
      const destination = this.#parent;
      if (!instanceId || !destination) return;
      const bounds = grid.getBoundingClientRect();
      const columns =
        Number(
          grid
            .closest<HTMLElement>("[data-d6-storage-workspace]")
            ?.style.getPropertyValue("--storage-columns"),
        ) || Number(record(context).columns);
      const rows = Number(record(context).rows);
      const x = Math.max(
        0,
        Math.min(
          columns - 1,
          Math.floor(((event.clientX - bounds.left) / bounds.width) * columns),
        ),
      );
      const y = Math.max(
        0,
        Math.min(
          rows - 1,
          Math.floor(((event.clientY - bounds.top) / bounds.height) * rows),
        ),
      );
      void this.#object(instanceId).then((object) => {
        if (!object) return;
        const destinationOption = this.#projection?.destinations.find(
          ({ parent }) =>
            parent.rootUuid === destination.rootUuid &&
            parent.spaceId === destination.spaceId &&
            parent.containerInstanceId === destination.containerInstanceId,
        );
        const footprint = destinationOption?.space.grid
          ? storageFootprint(
              object.definition.physical,
              destinationOption.space.grid,
              object.location.state === "placed"
                ? object.location.rectangle.rotation
                : "none",
            )
          : null;
        if (!footprint) return;
        void this.#requestMove(object, {
          destination,
          rectangle: {
            x,
            y,
            columns: footprint.columns,
            rows: footprint.rows,
            rotation:
              object.location.state === "placed"
                ? object.location.rectangle.rotation
                : "none",
          },
        });
      });
    });
    for (const tile of Array.from(
      this.element.querySelectorAll<HTMLElement>(
        "[draggable='true'][data-instance-id]",
      ),
    )) {
      tile.addEventListener(
        "dragstart",
        () => (tile.dataset.d6StorageDragging = "true"),
      );
      tile.addEventListener("dragend", () =>
        Reflect.deleteProperty(tile.dataset, "d6StorageDragging"),
      );
    }
  }
}

const applications = new Map<string, D6GridStorageApplication>();

export async function refreshRenderedGridStorageViews(
  rootUuids: readonly string[],
): Promise<void> {
  for (const rootUuid of new Set(rootUuids)) {
    const application = applications.get(rootUuid) as
      (D6GridStorageApplication & { readonly rendered?: boolean }) | undefined;
    if (application?.rendered === true) application.render(true);
    const actor = (await fromUuid(rootUuid)) as FoundryActorDocument | null;
    if (actor?.uuid === rootUuid) refreshRenderedGridStorageActorSheet(actor);
  }
}

export function registerGridStorageViewRefresh(): void {
  setGridStorageRefreshHandler(refreshRenderedGridStorageViews);
}

export async function openGridStorage(
  actor: FoundryActorDocument & { readonly uuid: string },
  parent?: D6StorageParentV1,
): Promise<void> {
  if (record(record(actor.system).storage).configured !== true) {
    if (!(await promptGridStorageConfiguration(actor))) return;
  }
  let application = applications.get(actor.uuid);
  if (!application) {
    application = new D6GridStorageApplication(actor, parent);
    applications.set(actor.uuid, application);
  }
  application.render(true);
}
