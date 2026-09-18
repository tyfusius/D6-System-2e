import { renderStorageSizing } from "./grid-storage-sizing.js";
import { itemStorageCapability } from "../item-storage-capability.js";
import { currencyWalletBlocksHolderRemoval } from "./currency-state.js";
import { SYSTEM_ID } from "../constants.js";
import { D6_STORAGE_SCALE_PRESETS } from "../application/grid-storage-configuration.js";
import { openGridStorage } from "./grid-storage-application.js";
import {
  requestGridStorageConfiguration,
  requestGridStorageProjection,
} from "./grid-storage-authority.js";
export { confirmGridStorageRootRemoval } from "./grid-storage-root-removal.js";
import { setGridStorageItemDisposition } from "./grid-storage-item-operation.js";
export {
  setGridStorageItemDisposition,
  setGridStorageItemQuantity,
} from "./grid-storage-item-operation.js";
import { requireGridStorageItemAction } from "./grid-storage-availability.js";
import { openMedicalConsumableUseDialog } from "./medical-consumable-dialog.js";
import {
  GRID_STORAGE_ITEM_TYPES,
  gridStorageItemParticipates,
  gridStoragePhysicalProfile,
} from "./grid-storage-document-adapter.js";
import { gridStorageEntryPoint } from "./grid-storage-projection.js";
import type { D6GridStoragePhysicalEditorVM } from "./grid-storage-view-model.js";

export interface D6GridStorageCreateActionVM {
  readonly action: "createItem";
  readonly canCreate: boolean;
  readonly icon: "fa-solid fa-plus";
  readonly itemType: (typeof GRID_STORAGE_ITEM_TYPES)[number];
  readonly label: string;
}

const createLabelKeys: Readonly<Record<string, string>> = Object.freeze({
  armor: "D6E2.New.Armor",
  cybernetic: "D6E2.New.Cybernetic",
  gear: "D6E2.New.Gear",
  "starship-gear": "D6E2.New.StarshipGear",
  "starship-weapon": "D6E2.New.StarshipWeapon",
  "vehicle-gear": "D6E2.New.VehicleGear",
  "vehicle-weapon": "D6E2.New.VehicleWeapon",
  weapon: "D6E2.New.Weapon",
});

function gridStorageCreateTypes(
  actor: FoundryActorDocument,
): readonly (typeof GRID_STORAGE_ITEM_TYPES)[number][] {
  if (actor.type === "starship")
    return ["starship-gear", "starship-weapon", "armor"];
  if (actor.type === "vehicle")
    return ["vehicle-gear", "vehicle-weapon", "armor"];
  return ["gear", "weapon", "armor", "cybernetic"];
}

export function gridStorageCreateActions(
  actor: FoundryActorDocument,
  editable: boolean,
): readonly D6GridStorageCreateActionVM[] {
  const canCreate =
    editable && (actor.isOwner === true || game.user?.isGM === true);
  return gridStorageCreateTypes(actor).map((itemType) => ({
    action: "createItem" as const,
    canCreate,
    icon: "fa-solid fa-plus" as const,
    itemType,
    label: game.i18n.localize(createLabelKeys[itemType] ?? "D6E2.New.Item"),
  }));
}

export async function createGridStorageItemForActor(
  actor: FoundryActorDocument,
  itemType: string,
): Promise<FoundryItemDocument | undefined> {
  if (
    (actor.isOwner !== true && game.user?.isGM !== true) ||
    !gridStorageCreateTypes(actor).includes(
      itemType as (typeof GRID_STORAGE_ITEM_TYPES)[number],
    )
  )
    return;
  const created = await actor.createEmbeddedDocuments("Item", [
    {
      name: game.i18n.localize(createLabelKeys[itemType] ?? "D6E2.New.Item"),
      type: itemType,
      ...(["starship", "vehicle"].includes(actor.type)
        ? { system: { context: actor.type } }
        : {}),
    },
  ]);
  const item = created[0];
  item?.sheet.render(true);
  return item;
}

export function openGridStorageSheetAction(sheet: {
  readonly actor: FoundryActorDocument;
}): void {
  if (!sheet.actor.uuid) return;
  void openGridStorage(
    sheet.actor as FoundryActorDocument & { readonly uuid: string },
  );
}

export async function openRawGridStorageItemForConfiguration(
  actor: FoundryActorDocument,
  target: HTMLElement,
): Promise<boolean> {
  const documentUuid =
    target.dataset.documentUuid ??
    target.closest<HTMLElement>("[data-document-uuid]")?.dataset.documentUuid;
  if (!documentUuid) return false;
  if (actor.isOwner !== true && game.user?.isGM !== true) return true;
  const item = (await fromUuid(documentUuid)) as FoundryItemDocument | null;
  if (
    item?.uuid !== documentUuid ||
    item.parent?.uuid !== actor.uuid ||
    !GRID_STORAGE_ITEM_TYPES.includes(
      item.type as (typeof GRID_STORAGE_ITEM_TYPES)[number],
    ) ||
    gridStorageItemParticipates(item)
  )
    return true;
  item.sheet.render(true);
  return true;
}

export function gridStorageSpaceEditorValues(
  element: HTMLElement,
): Record<string, unknown> {
  const editor =
    element.closest<HTMLElement>("[data-d6-storage-space-editor]") ??
    element.querySelector<HTMLElement>("[data-d6-storage-space-editor]");
  if (!editor) return {};
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

export function withoutGridStorageItemEditorFields(
  changes: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(changes).filter(
      ([key]) =>
        !key.startsWith("storagePhysical.") &&
        !key.startsWith("storageInterior."),
    ),
  );
}

export async function saveGridStorageSpaceEditor(
  actor: FoundryActorDocument & { readonly uuid: string },
  sheetElement: HTMLElement,
  target: HTMLElement,
  containerInstanceId?: string | null,
): Promise<void> {
  const editor =
    target.closest<HTMLElement>("[data-d6-storage-space-editor]") ??
    sheetElement.querySelector<HTMLElement>("[data-d6-storage-space-editor]");
  if (!editor) return;
  const resolvedContainerInstanceId =
    containerInstanceId ?? editor.dataset.containerInstanceId;
  await requestGridStorageConfiguration({
    kind: "space",
    documentUuid: actor.uuid,
    form: gridStorageSpaceEditorValues(editor),
    spaceId: editor.dataset.spaceId ?? target.dataset.spaceId ?? "primary",
    ...(resolvedContainerInstanceId
      ? { containerInstanceId: resolvedContainerInstanceId }
      : {}),
  });
}

export async function saveGridStorageItemConfiguration(
  request: Readonly<{
    documentUuid: string;
    form: Readonly<Record<string, unknown>>;
    scaleId: string;
  }>,
): Promise<boolean> {
  try {
    await requestGridStorageConfiguration({ kind: "item", ...request });
    return true;
  } catch (error) {
    ui.notifications.warn(
      game.i18n.localize(
        error instanceof Error
          ? error.message
          : "D6E2.Storage.Error.InvalidReceipt",
      ),
    );
    return false;
  }
}

export function refreshGridStorageItemOwnerSheet(
  item: FoundryItemDocument,
): boolean {
  const sheet = item.parent?.sheet as
    (FoundryDocumentSheet & { readonly rendered?: boolean }) | undefined;
  if (sheet?.rendered !== true) return false;
  sheet.render(true);
  return true;
}

export async function toggleGridStorageEquipped(
  actor: FoundryActorDocument & { readonly uuid: string },
  instanceId: string,
): Promise<boolean> {
  const projection = await requestGridStorageProjection({
    actorUuid: actor.uuid,
  });
  const object = projection.objects[instanceId];
  if (!object) return false;
  return setGridStorageItemDisposition(
    actor,
    instanceId,
    object.location.disposition === "equipped" ? "carried" : "equipped",
    projection,
  );
}

export async function useGridStorageItem(
  actor: FoundryActorDocument & { readonly uuid: string },
  instanceId: string,
): Promise<boolean> {
  const projection = await requestGridStorageProjection({
    actorUuid: actor.uuid,
  });
  const object = projection.objects[instanceId];
  if (!object) return false;
  const item = (await fromUuid(
    object.documentUuid,
  )) as FoundryItemDocument | null;
  if (!item) return false;
  await requireGridStorageItemAction(item, object.ownerActorUuid, "use");
  if (item.type === "gear" && item.system.gearCategory === "medical-consumable")
    openMedicalConsumableUseDialog(item);
  else item.sheet.render(true);
  return true;
}

export async function gridStorageActorSheetContext(
  actor: FoundryActorDocument,
  editable = false,
): Promise<Record<string, unknown>> {
  const entry = gridStorageEntryPoint(actor);
  if (!actor.uuid)
    return {
      storageCreateActions: [],
      storageEntryPoint: entry,
      storageWorkspaceHtml: "",
    };
  try {
    const projection = await requestGridStorageProjection({
      actorUuid: actor.uuid,
    });
    const workspace = projection.workspace;
    return {
      storageEntryPoint: entry,
      storageCreateActions: workspace
        ? gridStorageCreateActions(actor, editable)
        : [],
      storageWorkspaceHtml: workspace
        ? await foundry.applications.handlebars.renderTemplate(
            `systems/${SYSTEM_ID}/templates/apps/grid-storage-workspace.hbs`,
            workspace as unknown as Record<string, unknown>,
          )
        : "",
      storageSpaceEditor: workspace?.spaceEditor ?? null,
    };
  } catch {
    return {
      storageCreateActions: [],
      storageEntryPoint: entry,
      storageWorkspaceHtml: "",
    };
  }
}

export function gridStorageItemSheetContext(
  item: FoundryItemDocument,
): Record<string, unknown> {
  if (
    !GRID_STORAGE_ITEM_TYPES.includes(
      item.type as (typeof GRID_STORAGE_ITEM_TYPES)[number],
    )
  )
    return {};
  const capability = itemStorageCapability(item);
  const canEdit =
    item.parent?.isOwner === true ||
    item.isOwner === true ||
    game.user?.isGM === true;
  const funded = currencyWalletBlocksHolderRemoval(item);
  const physical = gridStoragePhysicalProfile(item.system);
  const scaleId = Object.keys(physical.footprintsByScale)[0] ?? "personal-100";
  const footprint = physical.footprintsByScale[scaleId];
  const interiorSource =
    item.system.storageInterior &&
    typeof item.system.storageInterior === "object" &&
    !Array.isArray(item.system.storageInterior)
      ? (item.system.storageInterior as Record<string, unknown>)
      : {};
  const interiorScaleId =
    typeof interiorSource.scaleId === "string" && interiorSource.scaleId
      ? interiorSource.scaleId
      : scaleId;
  const interiorPreset = Object.values(D6_STORAGE_SCALE_PRESETS).find(
    ({ id }) => id === interiorScaleId,
  );
  const interiorConfigured = interiorSource.configured === true;
  const instanceId =
    typeof item.system.storageInstanceId === "string"
      ? item.system.storageInstanceId
      : "";
  const editor: D6GridStoragePhysicalEditorVM = {
    instanceId,
    scaleId,
    sizePresetId: physical.presetId ?? "",
    sizePresetOptions: Object.fromEntries(
      Object.values(D6_STORAGE_SCALE_PRESETS).map(({ id, label }) => [
        id,
        label,
      ]),
    ),
    footprintColumns: footprint?.columns ?? null,
    footprintRows: footprint?.rows ?? null,
    scaleLabel:
      Object.values(D6_STORAGE_SCALE_PRESETS).find(
        (preset) => preset.id === scaleId,
      )?.label ?? scaleId,
    widthMm: physical.widthMm,
    depthMm: physical.depthMm,
    heightMm: physical.heightMm,
    unitWeightGrams: physical.unitTareWeightGrams,
    exteriorVolumeMillilitres: physical.unitExteriorVolumeMillilitres,
    maxQuantityPerPlacement: physical.stack.maxQuantityPerPlacement,
    rotatable: physical.rotatable,
    container: capability.enabled,
    interiorConfigured,
    interiorEditor: capability.enabled
      ? {
          label:
            typeof interiorSource.label === "string" && interiorSource.label
              ? interiorSource.label
              : game.i18n.localize("D6E2.Storage.ContainerInterior"),
          scalePresetId:
            interiorPreset?.id ?? (interiorConfigured ? "" : "personal-100"),
          customScaleId: interiorScaleId,
          scaleLabel:
            typeof interiorSource.scaleLabel === "string"
              ? interiorSource.scaleLabel
              : interiorScaleId,
          interiorHeightMm:
            typeof interiorSource.interiorHeightMm === "number"
              ? interiorSource.interiorHeightMm
              : null,
          scalePresetOptions: Object.fromEntries(
            Object.values(D6_STORAGE_SCALE_PRESETS).map(({ id, label }) => [
              id,
              label,
            ]),
          ),
          rows: interiorConfigured ? Number(interiorSource.rows) || 3 : 3,
          columns: interiorConfigured ? Number(interiorSource.columns) || 4 : 4,
          cellWidthMm: Number(interiorSource.cellWidthMm) || null,
          cellDepthMm: Number(interiorSource.cellDepthMm) || null,
          maxAggregateWeightGrams:
            Number.isSafeInteger(interiorSource.maxAggregateWeightGrams) &&
            Number(interiorSource.maxAggregateWeightGrams) >= 0
              ? Number(interiorSource.maxAggregateWeightGrams)
              : null,
          maxOccupiedVolumeMillilitres:
            Number.isSafeInteger(interiorSource.maxOccupiedVolumeMillilitres) &&
            Number(interiorSource.maxOccupiedVolumeMillilitres) >= 0
              ? Number(interiorSource.maxOccupiedVolumeMillilitres)
              : null,
          maxDirectChildren:
            Number.isSafeInteger(interiorSource.maxDirectChildren) &&
            Number(interiorSource.maxDirectChildren) >= 0
              ? Number(interiorSource.maxDirectChildren)
              : null,
          access:
            interiorSource.access === "closed" ||
            interiorSource.access === "locked"
              ? interiorSource.access
              : "open",
          fields: {
            label: "storageInterior.label",
            scalePresetId: "storageInterior.scalePresetId",
            rows: "storageInterior.rows",
            columns: "storageInterior.columns",
            cellWidthMm: "storageInterior.cellWidthMm",
            cellDepthMm: "storageInterior.cellDepthMm",
            maxAggregateWeightGrams: "storageInterior.maxAggregateWeightGrams",
            maxOccupiedVolumeMillilitres:
              "storageInterior.maxOccupiedVolumeMillilitres",
            maxDirectChildren: "storageInterior.maxDirectChildren",
            access: "storageInterior.access",
          },
        }
      : null,
    fields: {
      sizePresetId: "storagePhysical.sizePresetId",
      footprintColumns: "storagePhysical.footprintColumns",
      footprintRows: "storagePhysical.footprintRows",
      widthMm: "storagePhysical.widthMm",
      depthMm: "storagePhysical.depthMm",
      heightMm: "storagePhysical.heightMm",
      unitWeightGrams: "storagePhysical.unitWeightGrams",
      exteriorVolumeMillilitres: "storagePhysical.exteriorVolumeMillilitres",
      maxQuantityPerPlacement: "storagePhysical.maxQuantityPerPlacement",
      rotatable: "storagePhysical.rotatable",
      container: "storagePhysical.container",
    },
    canEdit,
    action: "saveStorageConfiguration",
  };
  return {
    storageEntryPoint: {
      context: "item-sheet",
      label: game.i18n.localize("D6E2.Storage.OpenStorage"),
      summary:
        interiorConfigured && typeof interiorSource.label === "string"
          ? interiorSource.label
          : game.i18n.localize("D6E2.Storage.ContainerInterior"),
      action: "openStorage",
      canOpen: Boolean(item.parent?.uuid && instanceId && interiorConfigured),
      unavailableReason:
        item.parent?.uuid && instanceId && interiorConfigured
          ? ""
          : game.i18n.localize(
              item.parent?.uuid
                ? "D6E2.Storage.OpenInteriorConfigurationHelp"
                : "D6E2.Storage.OpenInteriorWorldItemHelp",
            ),
    },
    storagePhysicalEditor: editor,
    storageCapability: {
      ...capability,
      canToggle:
        canEdit && !capability.inherent && !(capability.enabled && funded),
      unavailableReason: funded
        ? game.i18n.localize("D6E2.Storage.Currency.Error.FundsPresent")
        : "",
    },
  };
}

/** Uses the permission-filtered projection; authority repeats all checks before writing. */
export async function gridStorageItemCapabilityContext(
  item: FoundryItemDocument,
): Promise<Record<string, unknown>> {
  const context = gridStorageItemSheetContext(item);
  const physical = context.storagePhysicalEditor as
    D6GridStoragePhysicalEditorVM | undefined;
  if (physical?.interiorEditor)
    context.storagePhysicalEditor = {
      ...physical,
      interiorEditor: {
        ...physical.interiorEditor,
        sizingHtml: await renderStorageSizing(
          physical.interiorEditor,
          "storageInterior.",
          physical.canEdit,
        ),
      },
    };
  const capability = context.storageCapability as
    Record<string, unknown> | undefined;
  if (
    !capability?.canToggle ||
    !capability.enabled ||
    !item.parent?.uuid ||
    !item.system.storageInstanceId
  )
    return context;
  try {
    const projection = await requestGridStorageProjection({
      actorUuid: item.parent.uuid,
    });
    const occupied = Object.values(projection.objects).some(
      (object) =>
        object.location.state !== "unplaced" &&
        object.location.parent.containerInstanceId ===
          item.system.storageInstanceId,
    );
    if (occupied)
      Object.assign(capability, {
        canToggle: false,
        unavailableReason: game.i18n.localize(
          "D6E2.Storage.Error.StorageNotEmpty",
        ),
      });
  } catch {
    Object.assign(capability, {
      canToggle: false,
      unavailableReason: game.i18n.localize("D6E2.Storage.Error.AuthorityBusy"),
    });
  }
  return context;
}

export async function saveGridStorageItemCapability(
  item: FoundryItemDocument,
  enabled: boolean,
  gearCategory?: string,
): Promise<boolean> {
  if (!item.uuid) return false;
  try {
    await requestGridStorageConfiguration({
      kind: "item-capability",
      documentUuid: item.uuid,
      form: {
        enabled,
        ...(gearCategory === undefined ? {} : { gearCategory }),
      },
    });
    return true;
  } catch (error) {
    ui.notifications.warn(
      game.i18n.localize(
        error instanceof Error ? error.message : "D6E2.Storage.Error.Authority",
      ),
    );
    return false;
  }
}

export async function openGridStorageItemInterior(
  item: FoundryItemDocument,
): Promise<void> {
  if (!item.parent?.uuid || !itemStorageCapability(item).enabled) return;
  const projection = await requestGridStorageProjection({
    actorUuid: item.parent.uuid,
  });
  const object = projection.objects[String(item.system.storageInstanceId)];
  const interior = object?.definition.interior;
  if (!object || !interior) return;
  await openGridStorage(
    item.parent as FoundryActorDocument & { readonly uuid: string },
    {
      rootUuid:
        object.location.state === "unplaced"
          ? object.location.rootUuid
          : object.location.parent.rootUuid,
      spaceId: interior.id,
      containerInstanceId: object.definition.instanceId,
      spaceOwnerActorUuid: interior.ownerActorUuid,
    },
  );
}
