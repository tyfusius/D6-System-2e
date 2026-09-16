/* eslint-disable @typescript-eslint/unbound-method -- Foundry document methods are Vitest mocks asserted without invocation. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  configuration: vi.fn(),
  projection: vi.fn(),
  renderTemplate: vi.fn(() => Promise.resolve("<storage-workspace />")),
  warn: vi.fn(),
}));

vi.mock("./grid-storage-authority.js", () => ({
  requestGridStorageConfiguration: f.configuration,
  requestGridStorageProjection: f.projection,
}));
vi.mock("./grid-storage-application.js", () => ({
  openGridStorage: vi.fn(),
}));
vi.mock("./grid-storage-item-operation.js", () => ({
  setGridStorageItemDisposition: vi.fn(),
  setGridStorageItemQuantity: vi.fn(),
}));
vi.mock("./grid-storage-availability.js", () => ({
  requireGridStorageItemAction: vi.fn(),
}));
vi.mock("./medical-consumable-dialog.js", () => ({
  openMedicalConsumableUseDialog: vi.fn(),
}));
vi.mock("./grid-storage-projection.js", () => ({
  gridStorageEntryPoint: () => ({ action: "openStorage" }),
}));

import {
  createGridStorageItemForActor,
  gridStorageActorSheetContext,
  openRawGridStorageItemForConfiguration,
  refreshGridStorageItemOwnerSheet,
  saveGridStorageItemConfiguration,
  withoutGridStorageItemEditorFields,
} from "./grid-storage-sheet-integration.js";

function actor(type: string, isOwner = true) {
  const created = {
    sheet: { render: vi.fn() },
  } as unknown as FoundryItemDocument;
  return {
    created,
    document: {
      isOwner,
      type,
      uuid: `Actor.${type}`,
      createEmbeddedDocuments: vi.fn(() => Promise.resolve([created])),
    } as unknown as FoundryActorDocument,
  };
}

beforeEach(() => {
  f.projection.mockReset().mockResolvedValue({
    objects: {},
    workspace: { spaceEditor: null },
  });
  f.renderTemplate.mockClear();
  f.configuration.mockReset().mockResolvedValue(undefined);
  f.warn.mockClear();
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key },
    user: { isGM: false },
  });
  vi.stubGlobal("foundry", {
    applications: { handlebars: { renderTemplate: f.renderTemplate } },
  });
  vi.stubGlobal("ui", { notifications: { warn: f.warn } });
});

describe("configured storage sheet creation actions", () => {
  it("keeps storage editor controls out of an ordinary Item document submit", () => {
    expect(
      withoutGridStorageItemEditorFields({
        name: "Supply stack",
        "system.quantity": 3,
        "storagePhysical.footprintColumns": 1,
        "storagePhysical.maxQuantityPerPlacement": 3,
      }),
    ).toEqual({ name: "Supply stack", "system.quantity": 3 });
  });

  it("publishes exact editable Item types for character, machine, and location workspaces", async () => {
    const character = await gridStorageActorSheetContext(
      actor("character").document,
      true,
    );
    const starship = await gridStorageActorSheetContext(
      actor("starship").document,
      true,
    );
    const location = await gridStorageActorSheetContext(
      actor("storage-location").document,
      true,
    );

    expect(character.storageCreateActions).toMatchObject([
      { action: "createItem", canCreate: true, itemType: "gear" },
      { action: "createItem", canCreate: true, itemType: "weapon" },
      { action: "createItem", canCreate: true, itemType: "armor" },
      { action: "createItem", canCreate: true, itemType: "cybernetic" },
    ]);
    expect(starship.storageCreateActions).toMatchObject([
      { itemType: "starship-gear" },
      { itemType: "starship-weapon" },
      { itemType: "armor" },
    ]);
    expect(location.storageCreateActions).toMatchObject([
      { itemType: "gear" },
      { itemType: "weapon" },
      { itemType: "armor" },
      { itemType: "cybernetic" },
    ]);
  });

  it("keeps unauthorized controls disabled and creates only an allowed legacy no-ID Item", async () => {
    const unauthorized = actor("storage-location", false);
    const context = await gridStorageActorSheetContext(
      unauthorized.document,
      false,
    );
    expect(context.storageCreateActions).toEqual(
      expect.arrayContaining([expect.objectContaining({ canCreate: false })]),
    );

    await expect(
      createGridStorageItemForActor(unauthorized.document, "gear"),
    ).resolves.toBeUndefined();
    expect(
      unauthorized.document.createEmbeddedDocuments,
    ).not.toHaveBeenCalled();

    const fixture = actor("storage-location");
    await expect(
      createGridStorageItemForActor(fixture.document, "gear"),
    ).resolves.toBe(fixture.created);
    expect(fixture.document.createEmbeddedDocuments).toHaveBeenCalledWith(
      "Item",
      [{ name: "D6E2.New.Gear", type: "gear" }],
    );
    expect(fixture.created.sheet.render).toHaveBeenCalledWith(true);
    await expect(
      createGridStorageItemForActor(fixture.document, "starship-weapon"),
    ).resolves.toBeUndefined();
  });

  it("opens an authorized raw Item from an embedded workspace without assigning storage identity", async () => {
    const owner = actor("storage-location").document;
    const render = vi.fn();
    const rawItem = {
      uuid: `${owner.uuid}.Item.raw`,
      type: "gear",
      parent: owner,
      system: { quantity: 1, storageInstanceId: "" },
      sheet: { render },
    } as unknown as FoundryItemDocument;
    vi.stubGlobal(
      "fromUuid",
      vi.fn((uuid: string) =>
        Promise.resolve(uuid === rawItem.uuid ? rawItem : null),
      ),
    );

    await expect(
      openRawGridStorageItemForConfiguration(owner, {
        dataset: { documentUuid: rawItem.uuid },
      } as unknown as HTMLElement),
    ).resolves.toBe(true);
    expect(render).toHaveBeenCalledWith(true);
    expect(rawItem.system.storageInstanceId).toBe("");
  });

  it("surfaces a failed authoritative configuration in the visible UI", async () => {
    f.configuration.mockRejectedValueOnce(
      new Error("D6E2.Storage.Error.WitnessMismatch"),
    );
    await expect(
      saveGridStorageItemConfiguration({
        documentUuid: "Actor.character.Item.item",
        form: { widthMm: "2" },
        scaleId: "personal-100",
      }),
    ).resolves.toBe(false);
    expect(f.warn).toHaveBeenCalledWith("D6E2.Storage.Error.WitnessMismatch");
  });

  it("refreshes an already-open owner sheet after an Item joins storage", () => {
    const render = vi.fn();
    const item = {
      parent: { sheet: { rendered: true, render } },
    } as unknown as FoundryItemDocument;
    expect(refreshGridStorageItemOwnerSheet(item)).toBe(true);
    expect(render).toHaveBeenCalledWith(true);

    const closed = {
      parent: { sheet: { rendered: false, render } },
    } as unknown as FoundryItemDocument;
    expect(refreshGridStorageItemOwnerSheet(closed)).toBe(false);
    expect(render).toHaveBeenCalledTimes(1);
  });
});
