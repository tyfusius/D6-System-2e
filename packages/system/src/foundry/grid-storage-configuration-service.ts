import { itemStorageCapability } from "../item-storage-capability.js";
import {
  validateStorageLedger,
  type D6StorageConfigurationReceiptV1,
  type D6StorageDocumentImageV1,
  type D6StorageLocationV1,
  type D6StorageObjectV1,
  type D6StoragePhysicalProfileV1,
  type D6StorageRootKind,
  type D6StorageRootV1,
  type D6StorageSpaceV1,
  type D6StorageTransactionReceiptV1,
  type D6StorageWriteV1,
} from "@d6-system-2e/core";
import {
  D6_STORAGE_SCALE_PRESETS,
  physicalProfileFromStorageForm,
  storageSpaceFromForm,
  type D6StorageScalePreset,
} from "../application/grid-storage-configuration.js";
import { destinyClientIsAuthority } from "./destiny-crypto.js";
import {
  GRID_STORAGE_ITEM_TYPES,
  gridStorageDocumentWitness,
  gridStorageInteriorSpace,
  gridStorageInteriorSystem,
  gridStorageItemParticipates,
  gridStoragePhysicalProfile,
} from "./grid-storage-document-adapter.js";
import { GRID_STORAGE_AUTHORITY_WRITE_OPTION } from "./grid-storage-mutation-guard.js";
import {
  applyGridStorageDocumentWrite,
  compensateGridStorageDocumentWrite,
  gridStorageWriteAlreadyApplied,
  gridStorageWriteBeforeStatePresent,
} from "./grid-storage-document-executor.js";
import {
  mutateGridStorageAuthorityState,
  readGridStorageAuthorityState,
  runGridStorageAuthorityEffect,
} from "./grid-storage-state.js";
import { currencyWalletBlocksHolderRemoval } from "./currency-state.js";
import { foundryRandomId } from "./foundry-random-id.js";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const authorityWriteOptions = (): Record<string, unknown> => ({
  [GRID_STORAGE_AUTHORITY_WRITE_OPTION]: true,
});

function requireAuthority(): void {
  if (!game.user?.isGM || !destinyClientIsAuthority())
    throw new Error("D6E2.Storage.Error.Authority");
}

function rootKind(actor: FoundryActorDocument): D6StorageRootKind {
  if (actor.type === "character") return "character";
  if (actor.type === "storage-location") return "storage-location";
  return actor.type === "starship" ? "starship" : "vehicle";
}

function supportedItem(item: FoundryItemDocument): boolean {
  return GRID_STORAGE_ITEM_TYPES.includes(
    item.type as (typeof GRID_STORAGE_ITEM_TYPES)[number],
  );
}

function formField(form: unknown, prefix: string, key: string): unknown {
  const source = record(form);
  if (Object.hasOwn(source, `${prefix}.${key}`))
    return source[`${prefix}.${key}`];
  return record(source[prefix])[key];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function interiorFromForm(
  form: unknown,
  currentSystem: Record<string, unknown>,
  ownerActorUuid: string,
  instanceId: string,
  scaleId: string,
): D6StorageSpaceV1 | undefined {
  const source = record(form);
  if (!(source.container === true || source.container === "true")) return;
  const existing = gridStorageInteriorSpace(
    currentSystem,
    ownerActorUuid,
    instanceId,
  );
  const existingGrid = existing?.grid ?? undefined;
  const requestedScale = formField(form, "storageInterior", "scalePresetId");
  const requestedPresetId = text(requestedScale);
  const presetId =
    requestedScale !== undefined
      ? requestedPresetId
      : (existingGrid?.scaleId ??
        (Object.hasOwn(D6_STORAGE_SCALE_PRESETS, scaleId)
          ? scaleId
          : "personal-100"));
  const presets: Readonly<Record<string, D6StorageScalePreset | undefined>> =
    D6_STORAGE_SCALE_PRESETS;
  const preset = presets[presetId];
  const requestedLabel = text(formField(form, "storageInterior", "label"));
  return storageSpaceFromForm(
    {
      label:
        requestedLabel.length > 0
          ? requestedLabel
          : (existing?.label ??
            game.i18n.localize("D6E2.Storage.ContainerInterior")),
      configuration: "grid",
      kind: "container",
      spacePresetId: formField(form, "storageInterior", "spacePresetId"),
      interiorHeightMm:
        formField(form, "storageInterior", "interiorHeightMm") ??
        existing?.interiorHeightMm ??
        null,
      scalePresetId: preset?.id ?? "",
      customScaleId: preset
        ? ""
        : (formField(form, "storageInterior", "customScaleId") ?? presetId),
      scaleLabel: existingGrid?.scaleLabel ?? presetId,
      columns:
        formField(form, "storageInterior", "columns") ??
        existingGrid?.columns ??
        4,
      rows:
        formField(form, "storageInterior", "rows") ?? existingGrid?.rows ?? 3,
      cellWidthMm:
        formField(form, "storageInterior", "cellWidthMm") ??
        existingGrid?.cellWidthMm ??
        preset?.cellWidthMm ??
        100,
      cellDepthMm:
        formField(form, "storageInterior", "cellDepthMm") ??
        existingGrid?.cellDepthMm ??
        preset?.cellDepthMm ??
        100,
      maxAggregateWeightGrams:
        formField(form, "storageInterior", "maxAggregateWeightGrams") ??
        existing?.limits.maxAggregateWeightGrams ??
        "",
      maxOccupiedVolumeMillilitres:
        formField(form, "storageInterior", "maxOccupiedVolumeMillilitres") ??
        existing?.limits.maxOccupiedVolumeMillilitres ??
        "",
      maxDirectChildren:
        formField(form, "storageInterior", "maxDirectChildren") ??
        existing?.limits.maxDirectChildren ??
        "",
      access:
        formField(form, "storageInterior", "access") ??
        existing?.access ??
        "open",
    },
    ownerActorUuid,
    `container:${instanceId}`,
    ownerActorUuid,
  );
}

async function proposedObject(
  item: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  },
  instanceId: string,
  physical: D6StoragePhysicalProfileV1,
  interior: D6StorageSpaceV1 | undefined,
  location: D6StorageLocationV1,
): Promise<D6StorageObjectV1> {
  const source = structuredClone(item.toObject()) as Record<string, unknown>;
  const system = record(source.system);
  system.storageInstanceId = instanceId;
  system.storagePhysical = physical;
  system.storageInterior = gridStorageInteriorSystem(interior);
  source.system = system;
  if (!Number.isSafeInteger(system.quantity) || Number(system.quantity) <= 0)
    throw new Error("D6E2.Storage.Error.InvalidQuantity");
  return {
    version: 1,
    definition: {
      version: 1,
      instanceId,
      physical,
      ...(interior ? { interior } : {}),
    },
    documentUuid: item.uuid,
    ownerActorUuid: item.parent.uuid,
    quantity: Number(system.quantity),
    witness: await gridStorageDocumentWitness(source),
    location,
  };
}

function requireValidLedger(
  ledger: Parameters<typeof validateStorageLedger>[0],
): void {
  const validation = validateStorageLedger(ledger);
  if (!validation.valid) throw new Error("D6E2.Storage.Error.InvalidLedger");
}

function configurationReceipts(
  state: Awaited<ReturnType<typeof readGridStorageAuthorityState>>,
): Readonly<Record<string, D6StorageConfigurationReceiptV1>> {
  return state.configurationReceipts ?? {};
}

function locationRoot(location: D6StorageLocationV1): string {
  return location.state === "unplaced"
    ? location.rootUuid
    : location.parent.rootUuid;
}

function operationReceiptTouchesRoot(
  receipt: D6StorageTransactionReceiptV1,
  rootUuid: string,
  instanceIds: ReadonlySet<string>,
): boolean {
  for (const locations of [receipt.beforeLocations, receipt.afterLocations])
    for (const [instanceId, location] of Object.entries(locations))
      if (instanceIds.has(instanceId) || locationRoot(location) === rootUuid)
        return true;
  const request = receipt.request.value;
  if ("instanceId" in request && instanceIds.has(request.instanceId))
    return true;
  if (
    "containerInstanceId" in request &&
    instanceIds.has(request.containerInstanceId)
  )
    return true;
  if ("parent" in request && request.parent.rootUuid === rootUuid) return true;
  return "destination" in request && request.destination?.rootUuid === rootUuid;
}

async function documentImage(
  item: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  },
  source: Readonly<Record<string, unknown>>,
): Promise<D6StorageDocumentImageV1> {
  return {
    documentUuid: item.uuid,
    parentActorUuid: item.parent.uuid,
    source,
    witness: await gridStorageDocumentWitness(source),
  };
}

async function configurationWrite(
  item: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  },
  changes: Readonly<Record<string, unknown>>,
  sequence: number,
): Promise<D6StorageWriteV1> {
  const beforeSource = structuredClone(item.toObject()) as Record<
    string,
    unknown
  >;
  const afterSource = structuredClone(beforeSource);
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split(".");
    let target = afterSource;
    for (const part of parts.slice(0, -1)) {
      const child = target[part];
      if (!child || typeof child !== "object" || Array.isArray(child))
        target[part] = {};
      target = target[part] as Record<string, unknown>;
    }
    target[parts.at(-1) ?? path] = structuredClone(value);
  }
  return {
    sequence,
    kind: "update",
    documentUuid: item.uuid,
    before: await documentImage(item, beforeSource),
    after: await documentImage(item, afterSource),
    state: "planned",
  };
}

async function persistConfigurationReceipt(
  receipt: D6StorageConfigurationReceiptV1,
  expectedRevision: number | null = receipt.beforeRevision,
): Promise<D6StorageConfigurationReceiptV1> {
  return mutateGridStorageAuthorityState(expectedRevision, (state) => {
    const previous = configurationReceipts(state)[receipt.operationId];
    const competing = Object.values(configurationReceipts(state)).find(
      (candidate) =>
        candidate.operationId !== receipt.operationId &&
        (candidate.state === "intent-recorded" ||
          candidate.state === "reserved" ||
          candidate.state === "documents-applied"),
    );
    if (!previous && competing)
      throw new Error("D6E2.Storage.Error.AuthorityBusy");
    if (
      previous &&
      (previous.beforeRevision !== receipt.beforeRevision ||
        previous.kind !== receipt.kind)
    )
      throw new Error("D6E2.Storage.Error.InvalidReceipt");
    return [
      {
        ...state,
        configurationReceipts: {
          ...configurationReceipts(state),
          [receipt.operationId]: receipt,
        },
      },
      receipt,
    ];
  });
}

async function markConfigurationNeedsAttention(
  receipt: D6StorageConfigurationReceiptV1,
): Promise<void> {
  await persistConfigurationReceipt(
    { ...receipt, state: "needs-attention" },
    null,
  );
}

async function removeConfigurationReceipt(
  receipt: D6StorageConfigurationReceiptV1,
  expectedRevision: number | null,
): Promise<void> {
  await mutateGridStorageAuthorityState(expectedRevision, (state) => {
    const receipts = { ...configurationReceipts(state) };
    Reflect.deleteProperty(receipts, receipt.operationId);
    return [{ ...state, configurationReceipts: receipts }, undefined];
  });
}

async function assertConfigurationRevision(
  receipt: D6StorageConfigurationReceiptV1,
): Promise<void> {
  const current = await readGridStorageAuthorityState();
  if (current.ledger.revision !== receipt.beforeRevision)
    throw new Error("D6E2.Storage.Error.Stale");
  const durable = configurationReceipts(current)[receipt.operationId];
  if (
    !durable ||
    durable.state === "needs-attention" ||
    durable.state === "compensated"
  )
    throw new Error("D6E2.Storage.Error.InvalidReceipt");
}

async function applyConfigurationWrites(
  receipt: D6StorageConfigurationReceiptV1,
): Promise<D6StorageConfigurationReceiptV1> {
  let current = receipt;
  if (current.state === "intent-recorded")
    current = await persistConfigurationReceipt({
      ...current,
      state: "reserved",
    });
  for (let index = 0; index < current.writes.length; index += 1) {
    const write = current.writes[index];
    if (!write) throw new Error("D6E2.Storage.Error.InvalidReceipt");
    if (write.state === "verified") continue;
    await assertConfigurationRevision(current);
    if (write.state === "planned") {
      await applyGridStorageDocumentWrite(write);
      current = await persistConfigurationReceipt({
        ...current,
        writes: current.writes.map((candidate, sequence) =>
          sequence === index
            ? { ...candidate, state: "applied" as const }
            : candidate,
        ),
      });
    }
    await assertConfigurationRevision(current);
    const refreshed = current.writes[index];
    if (!refreshed || !(await gridStorageWriteAlreadyApplied(refreshed)))
      throw new Error("D6E2.Storage.Error.WitnessMismatch");
    current = await persistConfigurationReceipt({
      ...current,
      writes: current.writes.map((candidate, sequence) =>
        sequence === index
          ? { ...candidate, state: "verified" as const }
          : candidate,
      ),
    });
  }
  return persistConfigurationReceipt({
    ...current,
    state: "documents-applied",
  });
}

async function compensateConfigurationWrites(
  receipt: D6StorageConfigurationReceiptV1,
): Promise<D6StorageConfigurationReceiptV1> {
  let current = receipt;
  for (let index = current.writes.length - 1; index >= 0; index -= 1) {
    const write = current.writes[index];
    if (!write || write.state === "compensated") continue;
    await compensateGridStorageDocumentWrite(write);
    current = await persistConfigurationReceipt(
      {
        ...current,
        writes: current.writes.map((candidate, sequence) =>
          sequence === index
            ? { ...candidate, state: "compensated" as const }
            : candidate,
        ),
      },
      null,
    );
  }
  await removeConfigurationReceipt(current, null);
  return { ...current, state: "compensated" };
}

async function commitConfigurationLedger(
  receipt: D6StorageConfigurationReceiptV1,
): Promise<D6StorageConfigurationReceiptV1> {
  return mutateGridStorageAuthorityState(
    receipt.beforeRevision,
    (state) => {
      const durable = configurationReceipts(state)[receipt.operationId];
      if (durable?.state !== "documents-applied")
        throw new Error("D6E2.Storage.Error.InvalidReceipt");
      const committed = { ...durable, state: "ledger-applied" as const };
      const receipts = { ...state.receipts };
      for (const operationId of receipt.disabledUndoReceiptOperationIds ?? []) {
        const historical = receipts[operationId];
        if (historical)
          receipts[operationId] = { ...historical, undoEligible: false };
      }
      return [
        {
          ...state,
          ledger: structuredClone(receipt.afterLedger),
          receipts,
          configurationReceipts: {
            ...configurationReceipts(state),
            [receipt.operationId]: committed,
          },
        },
        committed,
      ];
    },
    { configurationOperationId: receipt.operationId },
  );
}

async function finishConfigurationReceipt(
  receipt: D6StorageConfigurationReceiptV1,
  knownActor?: FoundryActorDocument & { readonly uuid: string },
): Promise<D6StorageConfigurationReceiptV1> {
  const actorChange = receipt.actorConfigured;
  if (actorChange) {
    const state = await readGridStorageAuthorityState();
    if (!!state.ledger.roots[actorChange.actorUuid] !== actorChange.after)
      throw new Error("D6E2.Storage.Error.Stale");
    const actor =
      knownActor?.uuid === actorChange.actorUuid
        ? knownActor
        : ((await fromUuid(actorChange.actorUuid)) as
            (FoundryActorDocument & { readonly uuid?: string }) | null);
    if (!actor?.uuid || actor.uuid !== actorChange.actorUuid)
      throw new Error("D6E2.Storage.Error.Deleted");
    const configured = record(record(actor.system).storage).configured === true;
    if (configured !== actorChange.after) {
      if (configured !== actorChange.before)
        throw new Error("D6E2.Storage.Error.WitnessMismatch");
      await actor.update({
        "system.storage.configured": actorChange.after,
        "system.storage.version": 1,
      });
    }
  }
  await removeConfigurationReceipt(receipt, null);
  return { ...receipt, state: "completed" };
}

async function executeConfigurationReceipt(
  receipt: D6StorageConfigurationReceiptV1,
  knownActor?: FoundryActorDocument & { readonly uuid: string },
): Promise<void> {
  let current = await persistConfigurationReceipt(receipt);
  try {
    current = await applyConfigurationWrites(current);
    current = await commitConfigurationLedger(current);
    await finishConfigurationReceipt(current, knownActor);
  } catch (error) {
    if (current.state !== "ledger-applied") {
      try {
        await compensateConfigurationWrites(current);
      } catch {
        await markConfigurationNeedsAttention(current);
      }
    }
    throw error;
  }
}

async function recoverConfigurationReceipt(
  receipt: D6StorageConfigurationReceiptV1,
): Promise<void> {
  if (receipt.state === "completed" || receipt.state === "compensated") return;
  if (receipt.state === "needs-attention") {
    const state = await readGridStorageAuthorityState();
    if (state.ledger.revision !== receipt.beforeRevision) return;
    for (const write of receipt.writes) {
      if (
        (await gridStorageWriteBeforeStatePresent(write)) ||
        !(await gridStorageWriteAlreadyApplied(write))
      )
        return;
    }
    await executeConfigurationReceipt({
      ...receipt,
      state: "reserved",
      writes: receipt.writes.map((write) => ({
        ...write,
        state: "planned",
      })),
    });
    return;
  }
  if (receipt.state === "ledger-applied") {
    await finishConfigurationReceipt(receipt);
    return;
  }
  const state = await readGridStorageAuthorityState();
  if (state.ledger.revision !== receipt.beforeRevision) {
    await compensateConfigurationWrites(receipt);
    return;
  }
  await executeConfigurationReceipt(receipt);
}

async function recoverGridStorageConfigurationsUnlocked(): Promise<void> {
  if (!game.user?.isGM || !destinyClientIsAuthority()) return;
  const state = await readGridStorageAuthorityState();
  for (const operationId of Object.keys(configurationReceipts(state))) {
    const latest = configurationReceipts(await readGridStorageAuthorityState())[
      operationId
    ];
    if (!latest) continue;
    try {
      await recoverConfigurationReceipt(latest);
    } catch {
      const refreshed = configurationReceipts(
        await readGridStorageAuthorityState(),
      )[operationId];
      if (refreshed && refreshed.state !== "needs-attention")
        await markConfigurationNeedsAttention(refreshed);
    }
  }
}

export function recoverGridStorageConfigurations(): Promise<void> {
  return runGridStorageAuthorityEffect(
    recoverGridStorageConfigurationsUnlocked,
  );
}

async function configureGridStorageRootUnlocked(
  actor: FoundryActorDocument & { readonly uuid: string },
  form: unknown,
  spaceId = "primary",
): Promise<void> {
  requireAuthority();
  const state = await readGridStorageAuthorityState();
  if (state.ledger.roots[actor.uuid]) {
    await saveGridStorageSpaceUnlocked(actor, form, spaceId);
    return;
  }
  const space = storageSpaceFromForm(form, actor.uuid, spaceId, actor.uuid);
  const objects = { ...state.ledger.objects };
  const enrollments: {
    readonly item: FoundryItemDocument & {
      readonly uuid: string;
      readonly parent: FoundryActorDocument & { readonly uuid: string };
    };
    readonly instanceId: string;
  }[] = [];
  for (const rawItem of actor.items.contents) {
    if (!supportedItem(rawItem) || !rawItem.uuid || !rawItem.parent?.uuid)
      continue;
    const item = rawItem as (typeof enrollments)[number]["item"];
    const rawQuantity = record(item.system).quantity;
    if (!Number.isSafeInteger(rawQuantity) || Number(rawQuantity) <= 0) {
      if (gridStorageItemParticipates(item))
        throw new Error("D6E2.Storage.Error.InvalidQuantity");
      continue;
    }
    const instanceId = gridStorageItemParticipates(item)
      ? String(record(item.system).storageInstanceId)
      : foundryRandomId();
    if (!instanceId || objects[instanceId])
      throw new Error("D6E2.Storage.Error.MissingIdentity");
    const physical = gridStoragePhysicalProfile(item.system);
    const interior = gridStorageInteriorSpace(
      item.system,
      actor.uuid,
      instanceId,
    );
    const object = await proposedObject(item, instanceId, physical, interior, {
      state: "unplaced",
      rootUuid: actor.uuid,
      disposition:
        record(item.system).installed === true
          ? "installed"
          : record(item.system).equipped === true
            ? "equipped"
            : "carried",
    });
    objects[instanceId] = object;
    enrollments.push({ item, instanceId });
  }
  const root: D6StorageRootV1 = {
    version: 1,
    rootUuid: actor.uuid,
    kind: rootKind(actor),
    revision: 1,
    spaces: { [space.id]: space },
    publicSummary:
      record(record(actor.system).storage).publicSummary === "coarse-percent"
        ? "coarse-percent"
        : record(record(actor.system).storage).publicSummary ===
            "availability-only"
          ? "availability-only"
          : "none",
  };
  const ledger = {
    ...state.ledger,
    revision: state.ledger.revision + 1,
    roots: { ...state.ledger.roots, [actor.uuid]: root },
    objects,
  };
  requireValidLedger(ledger);

  const newlyAssigned = enrollments.filter(
    ({ item }) => !gridStorageItemParticipates(item),
  );
  const writes = await Promise.all(
    newlyAssigned.map(({ item, instanceId }, sequence) =>
      configurationWrite(
        item,
        { "system.storageInstanceId": instanceId },
        sequence,
      ),
    ),
  );
  const witnessedObjects = { ...objects };
  for (const { item, instanceId } of enrollments) {
    const afterImage = writes.find(
      (write) => write.documentUuid === item.uuid,
    )?.after;
    const witnessed =
      afterImage?.witness ??
      (await gridStorageDocumentWitness(structuredClone(item.toObject())));
    const object = witnessedObjects[instanceId];
    if (!object) throw new Error("D6E2.Storage.Error.MissingIdentity");
    witnessedObjects[instanceId] = { ...object, witness: witnessed };
  }
  await executeConfigurationReceipt(
    {
      version: 1,
      operationId: `configuration:${state.ledger.revision}:root:${actor.uuid}:${foundryRandomId()}`,
      kind: "root",
      state: "intent-recorded",
      beforeRevision: state.ledger.revision,
      afterLedger: { ...ledger, objects: witnessedObjects },
      actorConfigured: {
        actorUuid: actor.uuid,
        before: record(record(actor.system).storage).configured === true,
        after: true,
      },
      writes,
    },
    actor,
  );
}

export function configureGridStorageRoot(
  actor: FoundryActorDocument & { readonly uuid: string },
  form: unknown,
  spaceId = "primary",
): Promise<void> {
  return runGridStorageAuthorityEffect(() =>
    configureGridStorageRootUnlocked(actor, form, spaceId),
  );
}

async function removeGridStorageRootUnlocked(
  actor: FoundryActorDocument & { readonly uuid: string },
  baseRevision: number,
): Promise<void> {
  requireAuthority();
  const state = await readGridStorageAuthorityState();
  if (state.ledger.revision !== baseRevision)
    throw new Error("D6E2.Storage.Error.Stale");
  if (!state.ledger.roots[actor.uuid])
    throw new Error("D6E2.Storage.Error.RootUnavailable");
  if (Object.keys(configurationReceipts(state)).length > 0)
    throw new Error("D6E2.Storage.Error.AuthorityBusy");

  const ownedObjects = Object.values(state.ledger.objects).filter(
    (object) => object.ownerActorUuid === actor.uuid,
  );
  const locatedObjects = Object.values(state.ledger.objects).filter(
    (object) => locationRoot(object.location) === actor.uuid,
  );
  if (
    ownedObjects.some(
      (object) => locationRoot(object.location) !== actor.uuid,
    ) ||
    locatedObjects.some((object) => object.ownerActorUuid !== actor.uuid)
  )
    throw new Error("D6E2.Storage.Error.RootBoundary");

  const participatingItems = actor.items.contents.filter(
    (item) => supportedItem(item) && gridStorageItemParticipates(item),
  );
  if (
    currencyWalletBlocksHolderRemoval(actor) ||
    participatingItems.some(
      (item) =>
        record(item.system.storageInterior).configured === true &&
        currencyWalletBlocksHolderRemoval(item),
    )
  )
    throw new Error("D6E2.Storage.Currency.Error.FundsPresent");
  const participatingIds = new Set<string>();
  if (participatingItems.length !== locatedObjects.length)
    throw new Error("D6E2.Storage.Error.RootBoundary");
  for (const item of participatingItems) {
    const instanceId = text(record(item.system).storageInstanceId);
    const object = state.ledger.objects[instanceId];
    if (
      !item.uuid ||
      !item.parent?.uuid ||
      participatingIds.has(instanceId) ||
      object?.documentUuid !== item.uuid ||
      object.ownerActorUuid !== actor.uuid ||
      item.parent.uuid !== actor.uuid ||
      locationRoot(object.location) !== actor.uuid
    )
      throw new Error("D6E2.Storage.Error.RootBoundary");
    participatingIds.add(instanceId);
  }

  const removalIds = new Set(
    locatedObjects.map((object) => object.definition.instanceId),
  );
  for (const object of Object.values(state.ledger.objects))
    if (
      object.location.state !== "unplaced" &&
      object.location.parent.containerInstanceId &&
      removalIds.has(object.location.parent.containerInstanceId) &&
      !removalIds.has(object.definition.instanceId)
    )
      throw new Error("D6E2.Storage.Error.RootBoundary");

  const disabledUndoReceiptOperationIds: string[] = [];
  for (const receipt of Object.values(state.receipts)) {
    if (!operationReceiptTouchesRoot(receipt, actor.uuid, removalIds)) continue;
    if (receipt.state !== "completed" && receipt.state !== "compensated")
      throw new Error("D6E2.Storage.Error.AuthorityBusy");
    disabledUndoReceiptOperationIds.push(receipt.operationId);
  }

  const writes: D6StorageWriteV1[] = [];
  for (const [sequence, object] of [...locatedObjects]
    .sort((left, right) =>
      left.definition.instanceId.localeCompare(right.definition.instanceId),
    )
    .entries()) {
    const document = (await fromUuid(object.documentUuid)) as
      | (FoundryItemDocument & {
          readonly uuid: string;
          readonly parent: FoundryActorDocument & { readonly uuid: string };
        })
      | null;
    if (
      !document?.uuid ||
      document.uuid !== object.documentUuid ||
      document.parent.uuid !== actor.uuid ||
      !supportedItem(document) ||
      text(record(document.system).storageInstanceId) !==
        object.definition.instanceId
    )
      throw new Error("D6E2.Storage.Error.RootBoundary");
    const write = await configurationWrite(
      document,
      { "system.storageInstanceId": "" },
      sequence,
    );
    if (write.before?.witness !== object.witness)
      throw new Error("D6E2.Storage.Error.Stale");
    writes.push(write);
  }

  const roots = { ...state.ledger.roots };
  Reflect.deleteProperty(roots, actor.uuid);
  const objects = { ...state.ledger.objects };
  for (const instanceId of removalIds)
    Reflect.deleteProperty(objects, instanceId);
  const afterLedger = {
    ...state.ledger,
    revision: state.ledger.revision + 1,
    roots,
    objects,
  };
  requireValidLedger(afterLedger);
  await executeConfigurationReceipt(
    {
      version: 1,
      operationId: `configuration:${state.ledger.revision}:root-removal:${actor.uuid}:${foundryRandomId()}`,
      kind: "root-removal",
      state: "intent-recorded",
      beforeRevision: state.ledger.revision,
      afterLedger,
      actorConfigured: {
        actorUuid: actor.uuid,
        before: record(record(actor.system).storage).configured === true,
        after: false,
      },
      writes,
      disabledUndoReceiptOperationIds,
    },
    actor,
  );
}

export function removeGridStorageRoot(
  actor: FoundryActorDocument & { readonly uuid: string },
  baseRevision: number,
): Promise<void> {
  return runGridStorageAuthorityEffect(() =>
    removeGridStorageRootUnlocked(actor, baseRevision),
  );
}

async function saveGridStorageSpaceUnlocked(
  actor: FoundryActorDocument & { readonly uuid: string },
  form: unknown,
  spaceId = "primary",
): Promise<void> {
  requireAuthority();
  const state = await readGridStorageAuthorityState();
  const existing = state.ledger.roots[actor.uuid];
  if (!existing) {
    await configureGridStorageRootUnlocked(actor, form, spaceId);
    return;
  }
  const ownerActorUuid = existing.spaces[spaceId]?.ownerActorUuid ?? actor.uuid;
  const space = storageSpaceFromForm(
    {
      interiorHeightMm: existing.spaces[spaceId]?.interiorHeightMm ?? null,
      ...record(form),
    },
    actor.uuid,
    spaceId,
    ownerActorUuid,
  );
  const nextRoot = {
    ...existing,
    revision: existing.revision + 1,
    spaces: { ...existing.spaces, [spaceId]: space },
  };
  const ledger = {
    ...state.ledger,
    revision: state.ledger.revision + 1,
    roots: { ...state.ledger.roots, [actor.uuid]: nextRoot },
  };
  requireValidLedger(ledger);
  await mutateGridStorageAuthorityState(state.ledger.revision, (current) => [
    { ...current, ledger },
    undefined,
  ]);
  await actor.update({
    "system.storage.configured": true,
    "system.storage.version": 1,
  });
}

export function saveGridStorageSpace(
  actor: FoundryActorDocument & { readonly uuid: string },
  form: unknown,
  spaceId = "primary",
): Promise<void> {
  return runGridStorageAuthorityEffect(() =>
    saveGridStorageSpaceUnlocked(actor, form, spaceId),
  );
}

async function saveGridStorageInteriorUnlocked(
  container: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  },
  form: unknown,
): Promise<void> {
  requireAuthority();
  const instanceId = text(record(container.system).storageInstanceId);
  if (!instanceId) throw new Error("D6E2.Storage.Error.MissingIdentity");
  const state = await readGridStorageAuthorityState();
  const existing = state.ledger.objects[instanceId];
  if (existing?.documentUuid !== container.uuid)
    throw new Error("D6E2.Storage.Error.MissingIdentity");
  const currentScaleId =
    Object.keys(existing.definition.physical.footprintsByScale)[0] ??
    "personal-100";
  await configureGridStorageItemUnlocked(
    container,
    {
      footprintColumns:
        existing.definition.physical.footprintsByScale[currentScaleId]
          ?.columns ?? 1,
      footprintRows:
        existing.definition.physical.footprintsByScale[currentScaleId]?.rows ??
        1,
      maxQuantityPerPlacement:
        existing.definition.physical.stack.maxQuantityPerPlacement,
      stackMode: existing.definition.physical.stack.mode,
      rotatable: existing.definition.physical.rotatable,
      sizePresetId: existing.definition.physical.presetId ?? "",
      widthMm: existing.definition.physical.widthMm ?? "",
      depthMm: existing.definition.physical.depthMm ?? "",
      heightMm: existing.definition.physical.heightMm ?? "",
      unitWeightGrams: existing.definition.physical.unitTareWeightGrams ?? "",
      exteriorVolumeMillilitres:
        existing.definition.physical.unitExteriorVolumeMillilitres ?? "",
      container: true,
      storageInterior: record(form),
    },
    currentScaleId,
  );
}

export function saveGridStorageInterior(
  container: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  },
  form: unknown,
): Promise<void> {
  return runGridStorageAuthorityEffect(() =>
    saveGridStorageInteriorUnlocked(container, form),
  );
}

export function setGridStorageItemCapability(
  item: FoundryItemDocument & { readonly uuid: string },
  form: Readonly<Record<string, unknown>>,
): Promise<void> {
  return runGridStorageAuthorityEffect(async () => {
    requireAuthority();
    const capability = itemStorageCapability(item);
    if (!capability.supported || typeof form.enabled !== "boolean")
      throw new Error("D6E2.Storage.Error.StorageDisabled");
    const category = form.gearCategory;
    if (
      category !== undefined &&
      (item.type !== "gear" ||
        typeof category !== "string" ||
        !["general", "medical-consumable", "container"].includes(category))
    )
      throw new Error("D6E2.Storage.Error.StorageDisabled");
    if (capability.inherent && !form.enabled && category === undefined)
      throw new Error("D6E2.Storage.Error.InherentStorage");
    const enabled = category === "container" || form.enabled;
    const state = await readGridStorageAuthorityState();
    const instanceId = text(item.system.storageInstanceId);
    const existing = instanceId ? state.ledger.objects[instanceId] : undefined;
    if (instanceId && existing?.documentUuid !== item.uuid)
      throw new Error("D6E2.Storage.Error.MissingIdentity");
    if (
      Object.keys(configurationReceipts(state)).length ||
      Object.values(state.receipts).some(
        (receipt) =>
          !["completed", "compensated"].includes(receipt.state) &&
          operationReceiptTouchesRoot(
            receipt,
            item.parent?.uuid ?? "",
            new Set(instanceId ? [instanceId] : []),
          ),
      )
    )
      throw new Error("D6E2.Storage.Error.AuthorityBusy");
    if (!enabled) {
      if (currencyWalletBlocksHolderRemoval(item))
        throw new Error("D6E2.Storage.Currency.Error.FundsPresent");
      if (
        instanceId &&
        Object.values(state.ledger.objects).some(
          (object) =>
            object.location.state !== "unplaced" &&
            object.location.parent.containerInstanceId === instanceId,
        )
      )
        throw new Error("D6E2.Storage.Error.StorageNotEmpty");
    }
    const changes: Record<string, unknown> = {
      "system.hasStorage": enabled,
      ...(category === undefined ? {} : { "system.gearCategory": category }),
      ...(!enabled
        ? { "system.storageInterior": gridStorageInteriorSystem(undefined) }
        : {}),
    };
    if (!existing || !item.parent?.uuid) {
      await item.update(changes, authorityWriteOptions());
      return;
    }
    const embedded = item as FoundryItemDocument & {
      readonly uuid: string;
      readonly parent: FoundryActorDocument & { readonly uuid: string };
    };
    const write = await configurationWrite(embedded, changes, 0);
    const witness = write.after?.witness;
    if (!witness) throw new Error("D6E2.Storage.Error.InvalidReceipt");
    const definition = { ...existing.definition };
    if (!enabled) delete definition.interior;
    const afterLedger = {
      ...state.ledger,
      revision: state.ledger.revision + 1,
      objects: {
        ...state.ledger.objects,
        [instanceId]: { ...existing, definition, witness },
      },
    };
    requireValidLedger(afterLedger);
    await executeConfigurationReceipt({
      version: 1,
      operationId: `configuration:${state.ledger.revision}:item:${item.uuid}:${foundryRandomId()}`,
      kind: "item",
      state: "intent-recorded",
      beforeRevision: state.ledger.revision,
      afterLedger,
      actorConfigured: null,
      writes: [write],
    });
  });
}

async function configureGridStorageItemUnlocked(
  item: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  },
  form: unknown,
  scaleId: string,
): Promise<void> {
  requireAuthority();
  const capability = itemStorageCapability(item);
  if (!capability.enabled && record(form).container === true)
    throw new Error("D6E2.Storage.Error.StorageDisabled");
  form = { ...record(form), container: capability.enabled };
  const physical = physicalProfileFromStorageForm(
    form,
    gridStoragePhysicalProfile(item.system),
    scaleId,
  );
  const state = await readGridStorageAuthorityState();
  const parentRoot = state.ledger.roots[item.parent.uuid];
  const currentInstanceId = text(record(item.system).storageInstanceId);
  const existing = currentInstanceId
    ? state.ledger.objects[currentInstanceId]
    : undefined;
  if (currentInstanceId && !existing)
    throw new Error("D6E2.Storage.Error.MissingIdentity");

  const rawQuantity = record(item.system).quantity;
  const hasPositiveQuantity =
    Number.isSafeInteger(rawQuantity) && Number(rawQuantity) > 0;
  if (!hasPositiveQuantity) {
    if (currentInstanceId)
      throw new Error("D6E2.Storage.Error.InvalidQuantity");
    const metadataInterior = interiorFromForm(
      form,
      item.system,
      item.parent.uuid,
      "metadata-only",
      scaleId,
    );
    await item.update(
      {
        "system.storagePhysical": physical,
        "system.storageInterior": gridStorageInteriorSystem(metadataInterior),
      },
      authorityWriteOptions(),
    );
    return;
  }

  if (!parentRoot && !existing) {
    const metadataInterior = interiorFromForm(
      form,
      item.system,
      item.parent.uuid,
      "metadata-only",
      scaleId,
    );
    await item.update(
      {
        "system.storagePhysical": physical,
        "system.storageInterior": gridStorageInteriorSystem(metadataInterior),
      },
      authorityWriteOptions(),
    );
    return;
  }

  const instanceId = currentInstanceId || foundryRandomId();
  const interior = interiorFromForm(
    form,
    item.system,
    item.parent.uuid,
    instanceId,
    scaleId,
  );
  if (
    record(item.system.storageInterior).configured === true &&
    !interior &&
    currencyWalletBlocksHolderRemoval(item)
  )
    throw new Error("D6E2.Storage.Currency.Error.FundsPresent");
  if (interior && Number(record(item.system).quantity) !== 1)
    throw new Error("D6E2.Storage.Error.InvalidQuantity");
  const location: D6StorageLocationV1 = existing?.location ?? {
    state: "unplaced",
    rootUuid: item.parent.uuid,
    disposition:
      record(item.system).installed === true
        ? "installed"
        : record(item.system).equipped === true
          ? "equipped"
          : "carried",
  };
  const candidateObject = await proposedObject(
    item,
    instanceId,
    physical,
    interior,
    location,
  );
  const candidateLedger = {
    ...state.ledger,
    revision: state.ledger.revision + 1,
    objects: { ...state.ledger.objects, [instanceId]: candidateObject },
  };
  requireValidLedger(candidateLedger);

  const write = await configurationWrite(
    item,
    {
      "system.storagePhysical": physical,
      "system.storageInterior": gridStorageInteriorSystem(interior),
      "system.storageInstanceId": instanceId,
    },
    0,
  );
  const afterWitness = write.after?.witness;
  if (!afterWitness) throw new Error("D6E2.Storage.Error.InvalidReceipt");
  await executeConfigurationReceipt({
    version: 1,
    operationId: `configuration:${state.ledger.revision}:item:${item.uuid}:${foundryRandomId()}`,
    kind: "item",
    state: "intent-recorded",
    beforeRevision: state.ledger.revision,
    afterLedger: {
      ...candidateLedger,
      objects: {
        ...candidateLedger.objects,
        [instanceId]: { ...candidateObject, witness: afterWitness },
      },
    },
    actorConfigured: null,
    writes: [write],
  });
}

export function configureGridStorageWorldItem(
  item: FoundryItemDocument & { readonly uuid: string },
  form: unknown,
  scaleId: string,
): Promise<void> {
  return runGridStorageAuthorityEffect(async () => {
    requireAuthority();
    if (item.parent || !supportedItem(item) || item.system.storageInstanceId)
      throw new Error("D6E2.Storage.Error.Authority");
    const capability = itemStorageCapability(item);
    if (!capability.enabled && record(form).container === true)
      throw new Error("D6E2.Storage.Error.StorageDisabled");
    const physical = physicalProfileFromStorageForm(
      form,
      gridStoragePhysicalProfile(item.system),
      scaleId,
    );
    const interior = interiorFromForm(
      { ...record(form), container: capability.enabled },
      item.system,
      item.uuid,
      "metadata-only",
      scaleId,
    );
    await item.update(
      {
        "system.storagePhysical": physical,
        "system.storageInterior": gridStorageInteriorSystem(interior),
      },
      authorityWriteOptions(),
    );
  });
}

export function configureGridStorageItem(
  item: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  },
  form: unknown,
  scaleId: string,
): Promise<void> {
  return runGridStorageAuthorityEffect(() =>
    configureGridStorageItemUnlocked(item, form, scaleId),
  );
}
