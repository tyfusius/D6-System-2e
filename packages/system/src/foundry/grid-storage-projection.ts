import {
  effectiveStorageAvailability,
  evaluateStorageSpace,
  storageFootprint,
  storageSpace,
  type D6StorageLedgerV1,
  type D6StorageObjectV1,
  type D6StorageParentV1,
} from "@d6-system-2e/core";
import type {
  D6GridStorageEntryPointVM,
  D6GridStorageItemVM,
  D6GridStorageUnplacedItemVM,
  D6GridStorageWorkspaceVM,
  D6GridStorageSpaceEditorVM,
} from "./grid-storage-view-model.js";
import { D6_STORAGE_SCALE_PRESETS } from "../application/grid-storage-configuration.js";
import {
  GRID_STORAGE_ITEM_TYPES,
  gridStorageItemParticipates,
} from "./grid-storage-document-adapter.js";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const localize = (key: string): string => game.i18n.localize(key);
const locationRoot = (object: D6StorageObjectV1): string =>
  object.location.state === "unplaced"
    ? object.location.rootUuid
    : object.location.parent.rootUuid;
const sameParent = (
  object: D6StorageObjectV1,
  parent: D6StorageParentV1,
): boolean =>
  object.location.state !== "unplaced" &&
  object.location.parent.rootUuid === parent.rootUuid &&
  object.location.parent.spaceId === parent.spaceId &&
  object.location.parent.containerInstanceId === parent.containerInstanceId &&
  object.location.parent.spaceOwnerActorUuid === parent.spaceOwnerActorUuid;

function canObserve(actor: FoundryActorDocument, user: FoundryUser): boolean {
  const document = actor as FoundryActorDocument & {
    testUserPermission(candidate: FoundryUser, permission: string): boolean;
  };
  return (
    user.active && (user.isGM || document.testUserPermission(user, "OBSERVER"))
  );
}

function canOwn(actor: FoundryActorDocument, user: FoundryUser): boolean {
  return user.active && (user.isGM || actor.testUserPermission(user, "OWNER"));
}

async function itemDocument(
  object: D6StorageObjectV1,
): Promise<FoundryItemDocument | null> {
  const item = (await fromUuid(
    object.documentUuid,
  )) as FoundryItemDocument | null;
  return item?.uuid === object.documentUuid ? item : null;
}

export async function gridStorageRootFullyVisible(
  ledger: D6StorageLedgerV1,
  rootUuid: string,
  user: FoundryUser,
): Promise<boolean> {
  const actorUuids = new Set<string>([rootUuid]);
  for (const object of Object.values(ledger.objects))
    if (locationRoot(object) === rootUuid)
      actorUuids.add(object.ownerActorUuid);
  for (const uuid of actorUuids) {
    const document = (await fromUuid(uuid)) as FoundryActorDocument | null;
    if (!document || !canObserve(document, user)) return false;
  }
  return true;
}

function hiddenProjection(
  actor: FoundryActorDocument & { readonly uuid: string },
  rootKind: D6GridStorageWorkspaceVM["rootKind"],
): D6GridStorageWorkspaceVM {
  return {
    fixtureId: "live-permission-redacted",
    rootName: actor.name,
    rootKind,
    spaceName: localize("D6E2.Storage.Storage"),
    spaceKind: "cargo",
    revision: null,
    spaceMode: null,
    viewMode: "redacted",
    gridConfigured: null,
    canViewGrid: false,
    columns: null,
    rows: null,
    cellSizeLabel: localize("D6E2.Storage.DetailsHidden"),
    gridAriaLabel: `${actor.name} ${localize("D6E2.Storage.Storage")}`,
    breadcrumbs: [
      {
        id: "root",
        label: actor.name,
        current: true,
        rootUuid: actor.uuid,
        spaceId: "",
        containerInstanceId: null,
      },
    ],
    spaces: [],
    capacities: [
      {
        id: "grid",
        label: localize("D6E2.Storage.Availability"),
        value: localize("D6E2.Storage.AskOwner"),
        state: "hidden",
      },
      {
        id: "weight",
        label: localize("D6E2.Storage.Weight"),
        value: localize("D6E2.Storage.Hidden"),
        state: "hidden",
      },
      {
        id: "volume",
        label: localize("D6E2.Storage.Volume"),
        value: localize("D6E2.Storage.Hidden"),
        state: "hidden",
      },
      {
        id: "count",
        label: localize("D6E2.Storage.Items"),
        value: localize("D6E2.Storage.Hidden"),
        state: "hidden",
      },
    ],
    items: [],
    unplaced: [],
    selection: null,
    interaction: {
      dragState: "idle",
      ghostColumnStart: 0,
      ghostRowStart: 0,
      ghostColumnSpan: 0,
      ghostRowSpan: 0,
      issue: "",
      liveAnnouncement: "",
    },
    packPreview: null,
    spaceEditor: null,
    canEdit: false,
    canAutoPack: false,
    canUndo: false,
    hiddenContentNotice: localize("D6E2.Storage.HiddenContentNotice"),
  };
}

function capacityValue(
  state: string,
  available: string,
): { value: string; state: "available" | "blocked" | "unknown" } {
  if (state === "available") return { value: available, state: "available" };
  if (state === "unknown-measurement" || state === "not-configured")
    return { value: localize("D6E2.Storage.Unknown"), state: "unknown" };
  return { value: localize("D6E2.Storage.Exceeded"), state: "blocked" };
}

export function gridStorageEntryPoint(
  actor: FoundryActorDocument,
): D6GridStorageEntryPointVM {
  const configured = record(record(actor.system).storage).configured === true;
  const context =
    actor.type === "character"
      ? "character-sheet"
      : actor.type === "storage-location"
        ? "storage-location-sheet"
        : "machine-sheet";
  return {
    context,
    label: localize(
      configured ? "D6E2.Storage.OpenStorage" : "D6E2.Storage.ConfigureStorage",
    ),
    summary: localize(
      actor.type === "character"
        ? "D6E2.Storage.CharacterSummary"
        : actor.type === "storage-location"
          ? "D6E2.Storage.StorageLocation"
          : "D6E2.Storage.CargoSummary",
    ),
    action: "openStorage",
    canOpen: actor.isOwner === true || game.user?.isGM === true,
    unavailableReason: "",
  };
}

export function gridStorageSpaceEditor(
  actor: FoundryActorDocument & { readonly uuid: string },
  ledger: D6StorageLedgerV1,
  spaceId = "primary",
  editable = actor.isOwner === true || game.user?.isGM === true,
  containerInstanceId: string | null = null,
  requesterIsGM = false,
): D6GridStorageSpaceEditorVM | null {
  if (!editable) return null;
  const existing = containerInstanceId
    ? ledger.objects[containerInstanceId]?.definition.interior
    : ledger.roots[actor.uuid]?.spaces[spaceId];
  if (containerInstanceId && existing?.id !== spaceId) return null;
  const currentGrid = existing?.grid;
  const preset = currentGrid
    ? Object.values(D6_STORAGE_SCALE_PRESETS).find(
        ({ cellWidthMm, cellDepthMm }) =>
          cellWidthMm === currentGrid.cellWidthMm &&
          cellDepthMm === currentGrid.cellDepthMm,
      )
    : D6_STORAGE_SCALE_PRESETS["personal-100"];
  return {
    rootUuid: actor.uuid,
    spaceId,
    containerInstanceId,
    label: existing?.label ?? localize("D6E2.Storage.Storage"),
    configuration:
      existing?.configuration === "capacity-only" ? "capacity-only" : "grid",
    scalePresetId: preset?.id ?? "",
    scalePresetOptions: Object.fromEntries(
      Object.values(D6_STORAGE_SCALE_PRESETS).map(({ id, label }) => [
        id,
        label,
      ]),
    ),
    rows: existing?.grid?.rows ?? 3,
    columns: existing?.grid?.columns ?? 4,
    cellWidthMm: existing?.grid?.cellWidthMm ?? null,
    cellDepthMm: existing?.grid?.cellDepthMm ?? null,
    maxAggregateWeightGrams: existing?.limits.maxAggregateWeightGrams ?? null,
    maxOccupiedVolumeMillilitres:
      existing?.limits.maxOccupiedVolumeMillilitres ?? null,
    maxDirectChildren: existing?.limits.maxDirectChildren ?? null,
    access: existing?.access ?? "open",
    fields: {
      label: "space.label",
      configuration: "space.configuration",
      scalePresetId: "space.scalePresetId",
      rows: "space.rows",
      columns: "space.columns",
      cellWidthMm: "space.cellWidthMm",
      cellDepthMm: "space.cellDepthMm",
      maxAggregateWeightGrams: "space.maxAggregateWeightGrams",
      maxOccupiedVolumeMillilitres: "space.maxOccupiedVolumeMillilitres",
      maxDirectChildren: "space.maxDirectChildren",
      access: "space.access",
    },
    canEdit: true,
    action: "saveStorageConfiguration",
    canRemoveRoot:
      containerInstanceId === null &&
      !!ledger.roots[actor.uuid] &&
      requesterIsGM,
    removeAction: "removeStorageRoot",
    removeLabel: localize("D6E2.Storage.RemoveStorageRoot"),
    removeHelp: localize("D6E2.Storage.RemoveStorageRootHelp"),
  };
}

export async function buildGridStorageWorkspace(input: {
  readonly actor: FoundryActorDocument & { readonly uuid: string };
  readonly ledger: D6StorageLedgerV1;
  readonly user: FoundryUser;
  readonly parent?: D6StorageParentV1;
  readonly viewMode?: "grid" | "list";
  readonly canUndo?: boolean;
}): Promise<D6GridStorageWorkspaceVM | null> {
  const configured =
    record(record(input.actor.system).storage).configured === true;
  if (!configured) return null;
  const root = input.ledger.roots[input.actor.uuid];
  if (!root) return null;
  if (
    !(await gridStorageRootFullyVisible(
      input.ledger,
      input.actor.uuid,
      input.user,
    ))
  )
    return hiddenProjection(input.actor, root.kind);
  const rootSpace = Object.values(root.spaces)[0];
  const parent =
    input.parent ??
    (rootSpace
      ? {
          rootUuid: root.rootUuid,
          spaceId: rootSpace.id,
          containerInstanceId: null,
          spaceOwnerActorUuid: rootSpace.ownerActorUuid,
        }
      : undefined);
  if (!parent) return null;
  const space = storageSpace(input.ledger, parent);
  if (!space) return null;
  const editable = canOwn(input.actor, input.user);
  const documents = new Map<string, FoundryItemDocument>();
  for (const object of Object.values(input.ledger.objects)) {
    if (locationRoot(object) !== root.rootUuid) continue;
    const item = await itemDocument(object);
    if (item) documents.set(object.definition.instanceId, item);
  }
  const itemVMs: D6GridStorageItemVM[] = [];
  const unplacedVMs: D6GridStorageUnplacedItemVM[] = [];
  for (const object of Object.values(input.ledger.objects)) {
    if (locationRoot(object) !== root.rootUuid) continue;
    const document = documents.get(object.definition.instanceId);
    const availability = effectiveStorageAvailability(
      input.ledger,
      object.definition.instanceId,
      object.ownerActorUuid,
    );
    const equipLabel = localize(
      object.location.disposition === "equipped"
        ? "D6E2.Storage.Unequip"
        : "D6E2.Storage.Equip",
    );
    if (object.location.state === "unplaced") {
      const footprint = space.grid
        ? storageFootprint(object.definition.physical, space.grid)
        : null;
      unplacedVMs.push({
        instanceId: object.definition.instanceId,
        name: document?.name ?? localize("D6E2.Storage.UnknownItem"),
        image: document?.img ?? "icons/svg/item-bag.svg",
        quantity: object.quantity,
        footprintLabel: footprint
          ? `${footprint.columns} × ${footprint.rows}`
          : localize("D6E2.Storage.DimensionsUnknown"),
        measurementState: footprint ? "known" : "unknown-footprint",
        canPlace: editable && (!space.grid || Boolean(footprint)),
        canConfigure: editable,
        canUse: availability.canUse,
        canEquip: availability.canEquip,
        canUnequip: editable && object.location.disposition === "equipped",
        equipLabel,
        unavailableReason: availability.reachable
          ? ""
          : localize("D6E2.Storage.Unreachable"),
      });
    } else if (sameParent(object, parent)) {
      const rectangle =
        object.location.state === "placed"
          ? object.location.rectangle
          : { x: 0, y: 0, columns: 0, rows: 0, rotation: "none" as const };
      const geometryLabel =
        object.location.state === "placed"
          ? `${rectangle.columns} × ${rectangle.rows}, ${rectangle.x + 1}, ${rectangle.y + 1}`
          : localize("D6E2.Storage.CapacityOnly");
      itemVMs.push({
        instanceId: object.definition.instanceId,
        name: document?.name ?? localize("D6E2.Storage.UnknownItem"),
        image: document?.img ?? "icons/svg/item-bag.svg",
        x: rectangle.x,
        y: rectangle.y,
        columns: rectangle.columns,
        rows: rectangle.rows,
        gridColumnStart: rectangle.x + 1,
        gridRowStart: rectangle.y + 1,
        gridColumnSpan: rectangle.columns,
        gridRowSpan: rectangle.rows,
        rotation: rectangle.rotation,
        disposition: object.location.disposition,
        pinned: object.location.pinned,
        container: Boolean(object.definition.interior),
        quantity: object.quantity,
        listed: object.location.state === "listed",
        accessibleLabel: `${document?.name ?? localize("D6E2.Storage.UnknownItem")}, ${geometryLabel}`,
        canMove: editable,
        canPin: editable,
        canRotate: editable && object.definition.physical.rotatable,
        canOpen: Boolean(object.definition.interior),
        canConfigure: editable,
        canUse: availability.canUse,
        canEquip: availability.canEquip,
        canUnequip: editable && object.location.disposition === "equipped",
        equipLabel,
        unavailableReason: availability.reachable
          ? ""
          : localize("D6E2.Storage.Unreachable"),
      });
    }
  }
  if (editable) {
    const ledgerDocumentUuids = new Set(
      Object.values(input.ledger.objects).map(
        ({ documentUuid }) => documentUuid,
      ),
    );
    for (const item of input.actor.items.contents) {
      if (
        !item.uuid ||
        !GRID_STORAGE_ITEM_TYPES.includes(
          item.type as (typeof GRID_STORAGE_ITEM_TYPES)[number],
        ) ||
        gridStorageItemParticipates(item) ||
        ledgerDocumentUuids.has(item.uuid)
      )
        continue;
      const rawQuantity = record(item.system).quantity;
      unplacedVMs.push({
        instanceId: "",
        documentUuid: item.uuid,
        name: item.name,
        image: item.img,
        quantity:
          Number.isSafeInteger(rawQuantity) && Number(rawQuantity) > 0
            ? Number(rawQuantity)
            : 0,
        footprintLabel: localize("D6E2.Storage.SizeNeeded"),
        measurementState: "unknown-footprint",
        canPlace: false,
        canConfigure: true,
        canUse: false,
        canEquip: false,
        canUnequip: false,
        equipLabel: "",
        unavailableReason: localize("D6E2.Storage.ConfigureBeforePlacement"),
      });
    }
  }
  const capacity = evaluateStorageSpace(input.ledger, parent);
  const totalCells = space.grid ? space.grid.columns * space.grid.rows : 0;
  const usedCells = itemVMs.reduce(
    (sum, item) => sum + item.columns * item.rows,
    0,
  );
  return {
    fixtureId: "live-grid-storage",
    rootName: input.actor.name,
    rootKind: root.kind,
    spaceName: space.label,
    spaceKind: space.kind,
    revision: input.ledger.revision,
    spaceMode: space.configuration === "grid" ? "grid" : "capacity-only",
    viewMode:
      input.viewMode ?? (space.configuration === "grid" ? "grid" : "list"),
    gridConfigured: space.configuration === "grid",
    canViewGrid: space.configuration === "grid",
    columns: space.grid?.columns ?? 0,
    rows: space.grid?.rows ?? 0,
    cellSizeLabel:
      space.configuration === "capacity-only"
        ? localize("D6E2.Storage.CapacityOnly")
        : space.grid
          ? `${space.grid.cellWidthMm} × ${space.grid.cellDepthMm} mm`
          : localize("D6E2.Storage.GridNotConfigured"),
    gridAriaLabel: `${space.label}, ${space.grid?.columns ?? 0} × ${space.grid?.rows ?? 0}`,
    breadcrumbs: [
      {
        id: parent.containerInstanceId ?? "root",
        label: parent.containerInstanceId ? space.label : input.actor.name,
        current: true,
        rootUuid: parent.rootUuid,
        spaceId: parent.spaceId,
        containerInstanceId: parent.containerInstanceId,
      },
    ],
    spaces: Object.values(root.spaces).map((candidate) => ({
      id: candidate.id,
      label: candidate.label,
      kind: candidate.kind,
      active:
        candidate.id === parent.spaceId && parent.containerInstanceId === null,
      accessibleSummary:
        candidate.configuration === "grid" && candidate.grid
          ? `${candidate.grid.columns} × ${candidate.grid.rows}`
          : localize("D6E2.Storage.CapacityOnly"),
      rootUuid: root.rootUuid,
      spaceId: candidate.id,
      containerInstanceId: null,
    })),
    capacities: [
      ...(space.configuration === "grid"
        ? [
            {
              id: "grid" as const,
              label: localize("D6E2.Storage.Grid"),
              ...capacityValue(capacity.grid, `${usedCells} / ${totalCells}`),
            },
          ]
        : []),
      {
        id: "weight",
        label: localize("D6E2.Storage.Weight"),
        ...capacityValue(capacity.weight, localize("D6E2.Storage.Available")),
      },
      {
        id: "volume",
        label: localize("D6E2.Storage.Volume"),
        ...capacityValue(capacity.volume, localize("D6E2.Storage.Available")),
      },
      {
        id: "count",
        label: localize("D6E2.Storage.Items"),
        ...capacityValue(capacity.count, String(itemVMs.length)),
      },
    ],
    items: itemVMs,
    unplaced: unplacedVMs,
    selection: null,
    interaction: {
      dragState: "idle",
      ghostColumnStart: 0,
      ghostRowStart: 0,
      ghostColumnSpan: 0,
      ghostRowSpan: 0,
      issue: "",
      liveAnnouncement: "",
    },
    packPreview: null,
    spaceEditor: gridStorageSpaceEditor(
      input.actor,
      input.ledger,
      parent.spaceId,
      editable,
      parent.containerInstanceId,
      input.user.isGM,
    ),
    canEdit: editable,
    canAutoPack: editable && space.configuration === "grid",
    canUndo: editable && input.canUndo === true,
    hiddenContentNotice: "",
  };
}
