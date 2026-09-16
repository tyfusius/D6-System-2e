import { SYSTEM_ID } from "../../constants.js";
import { applicationV2FormOptions } from "../application-v2-form-options.js";
import { openGridStorage } from "../grid-storage-application.js";
import {
  createGridStorageItemForActor,
  confirmGridStorageRootRemoval,
  gridStorageActorSheetContext,
  openRawGridStorageItemForConfiguration,
  saveGridStorageSpaceEditor,
  toggleGridStorageEquipped,
  useGridStorageItem,
} from "../grid-storage-sheet-integration.js";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
);

export class D6System2eStorageLocationSheet extends Base {
  static PARTS = {
    main: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/storage-location-sheet.hbs`,
    },
  };

  static readonly #openStorage = function (
    this: D6System2eStorageLocationSheet,
  ): void {
    if (!this.actor.uuid) return;
    void openGridStorage(
      this.actor as FoundryActorDocument & { readonly uuid: string },
    );
  };

  static readonly #createItem = async function (
    this: D6System2eStorageLocationSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    await createGridStorageItemForActor(
      this.actor,
      target.dataset.itemType ?? "",
    );
    this.render();
  };

  static readonly #editStorageItemMeasurements = async function (
    this: D6System2eStorageLocationSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (await openRawGridStorageItemForConfiguration(this.actor, target))
      return;
    if (!this.actor.uuid) return;
    void openGridStorage(
      this.actor as FoundryActorDocument & { readonly uuid: string },
    );
  };

  static readonly #saveStorageConfiguration = async function (
    this: D6System2eStorageLocationSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable || !this.actor.uuid) return;
    await saveGridStorageSpaceEditor(
      this.actor as FoundryActorDocument & { readonly uuid: string },
      this.element,
      target,
    );
    this.render();
  };

  static readonly #removeStorageRoot = async function (
    this: D6System2eStorageLocationSheet,
  ): Promise<void> {
    if (!this.actor.uuid || !game.user?.isGM) return;
    if (
      await confirmGridStorageRootRemoval(
        this.actor as FoundryActorDocument & { readonly uuid: string },
      )
    )
      this.render();
  };

  static readonly #toggleEquipped = async function (
    this: D6System2eStorageLocationSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.actor.uuid || !target.dataset.instanceId) return;
    await toggleGridStorageEquipped(
      this.actor as FoundryActorDocument & { readonly uuid: string },
      target.dataset.instanceId,
    );
    this.render();
  };

  static readonly #useItem = async function (
    this: D6System2eStorageLocationSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.actor.uuid || !target.dataset.instanceId) return;
    await useGridStorageItem(
      this.actor as FoundryActorDocument & { readonly uuid: string },
      target.dataset.instanceId,
    );
  };

  static DEFAULT_OPTIONS = {
    actions: {
      createItem: D6System2eStorageLocationSheet.#createItem,
      openStorage: D6System2eStorageLocationSheet.#openStorage,
      selectStorageItem: D6System2eStorageLocationSheet.#openStorage,
      moveStorageItem: D6System2eStorageLocationSheet.#openStorage,
      rotateStorageItem: D6System2eStorageLocationSheet.#openStorage,
      toggleStoragePin: D6System2eStorageLocationSheet.#openStorage,
      openStorageContainer: D6System2eStorageLocationSheet.#openStorage,
      placeUnplacedStorageItem: D6System2eStorageLocationSheet.#openStorage,
      setStorageViewMode: D6System2eStorageLocationSheet.#openStorage,
      configureStorage: D6System2eStorageLocationSheet.#openStorage,
      editStorageItemMeasurements:
        D6System2eStorageLocationSheet.#editStorageItemMeasurements,
      previewAutoPack: D6System2eStorageLocationSheet.#openStorage,
      applyAutoPack: D6System2eStorageLocationSheet.#openStorage,
      cancelAutoPack: D6System2eStorageLocationSheet.#openStorage,
      undoStorageOperation: D6System2eStorageLocationSheet.#openStorage,
      unpackStorageContainer: D6System2eStorageLocationSheet.#openStorage,
      toggleEquipped: D6System2eStorageLocationSheet.#toggleEquipped,
      useItem: D6System2eStorageLocationSheet.#useItem,
      saveStorageConfiguration:
        D6System2eStorageLocationSheet.#saveStorageConfiguration,
      removeStorageRoot: D6System2eStorageLocationSheet.#removeStorageRoot,
    },
    classes: ["d6e2", "d6e2-storage-location", "od6-theme-classic"],
    form: applicationV2FormOptions({
      closeOnSubmit: false,
      handler: () => Promise.resolve(),
      submitOnChange: false,
    }),
    position: { height: 760, width: 980 },
    tag: "form",
    window: { icon: "fa-solid fa-warehouse", resizable: true },
  };

  async _prepareContext(): Promise<Record<string, unknown>> {
    const actor = this.actor as FoundryActorDocument & {
      readonly uuid: string;
    };
    const storageContext = await gridStorageActorSheetContext(
      actor,
      this.isEditable,
    );
    return {
      ...storageContext,
      actor,
      editable: this.isEditable,
    };
  }
}
