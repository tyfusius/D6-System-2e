import type {
  D6StorageDocumentImageV1,
  D6StorageLocationV1,
  D6StorageObjectV1,
  D6StoragePhysicalProfileV1,
  D6StorageReservedIdentityV1,
  D6StorageSpaceV1,
  D6StorageWriteV1,
} from "@d6-system-2e/core";
import { canonical } from "../application/first-edition-action-validation.js";
import { foundryRandomId } from "./foundry-random-id.js";
import { currencyWalletBlocksHolderRemoval } from "./currency-state.js";

export const GRID_STORAGE_ITEM_TYPES = Object.freeze([
  "armor",
  "cybernetic",
  "gear",
  "starship-gear",
  "starship-weapon",
  "vehicle",
  "vehicle-gear",
  "vehicle-weapon",
  "weapon",
] as const);

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const nullableInteger = (value: unknown): number | null =>
  Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
const positiveInteger = (value: unknown, fallback = 1): number =>
  Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : fallback;
const exactPositiveQuantity = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || Number(value) <= 0)
    throw new TypeError("D6E2.Storage.Error.InvalidQuantity");
  return Number(value);
};
const nonempty = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

function applyDispositionMirrors(
  system: Record<string, unknown>,
  disposition: D6StorageLocationV1["disposition"],
): void {
  system.equipped = disposition === "equipped";
  if (Object.hasOwn(system, "installed"))
    system.installed = disposition === "installed";
  else if (disposition === "installed")
    throw new TypeError("D6E2.Storage.Error.InvalidIntent");
}

export async function gridStorageWitness(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function normalizedGridStorageDocumentSource(value: unknown): unknown {
  const source = structuredClone(value);
  if (!source || typeof source !== "object" || Array.isArray(source))
    return source;
  const root = source as Record<string, unknown>;
  if (
    root._stats &&
    typeof root._stats === "object" &&
    !Array.isArray(root._stats)
  ) {
    const stats = record(root._stats);
    Reflect.deleteProperty(stats, "createdTime");
    Reflect.deleteProperty(stats, "modifiedTime");
    if (Object.keys(stats).length > 0) root._stats = stats;
    else Reflect.deleteProperty(root, "_stats");
  }
  const system = record(root.system);
  if (
    system.hasStorage ===
    (record(system.storageInterior).configured === true)
  )
    Reflect.deleteProperty(system, "hasStorage");
  const interior = record(system.storageInterior);
  if (interior.interiorHeightMm === null)
    Reflect.deleteProperty(interior, "interiorHeightMm");
  const storagePhysical = record(system.storagePhysical);
  if (storagePhysical.presetId === null) storagePhysical.presetId = "";
  return source;
}

export function gridStorageDocumentSourceEquivalent(
  expected: unknown,
  actual: unknown,
): boolean {
  return (
    canonical(normalizedGridStorageDocumentSource(expected)) ===
    canonical(normalizedGridStorageDocumentSource(actual))
  );
}

export function gridStorageDocumentWitness(value: unknown): Promise<string> {
  return gridStorageWitness(normalizedGridStorageDocumentSource(value));
}

export async function gridStorageDocumentMatchesWitness(
  value: unknown,
  witness: string,
): Promise<boolean> {
  return (
    (await gridStorageWitness(value)) === witness ||
    (await gridStorageDocumentWitness(value)) === witness
  );
}

export async function gridStorageDocumentImageMatches(
  value: unknown,
  image: D6StorageDocumentImageV1,
): Promise<boolean> {
  const sourceBound = await gridStorageDocumentMatchesWitness(
    image.source,
    image.witness,
  );
  return (
    sourceBound &&
    ((await gridStorageDocumentMatchesWitness(value, image.witness)) ||
      gridStorageDocumentSourceEquivalent(image.source, value))
  );
}

export function gridStoragePhysicalProfile(
  system: Record<string, unknown>,
): D6StoragePhysicalProfileV1 {
  const source = record(system.storagePhysical);
  const stack = record(source.stack);
  const footprints = Object.fromEntries(
    Object.entries(record(source.footprintsByScale)).flatMap(
      ([scaleId, raw]) => {
        const footprint = record(raw);
        const columns = positiveInteger(footprint.columns, 0);
        const rows = positiveInteger(footprint.rows, 0);
        return columns > 0 && rows > 0
          ? [
              [
                scaleId,
                {
                  columns,
                  rows,
                  provenance:
                    footprint.provenance === "preset"
                      ? ("preset" as const)
                      : ("user" as const),
                },
              ],
            ]
          : [];
      },
    ),
  );
  const mode = stack.mode === "bounded" ? "bounded" : "single";
  return {
    version: 1,
    provenance:
      source.provenance === "preset" || source.provenance === "measured"
        ? source.provenance
        : "unknown",
    presetId: nonempty(source.presetId),
    widthMm: nullableInteger(source.widthMm),
    depthMm: nullableInteger(source.depthMm),
    heightMm: nullableInteger(source.heightMm),
    unitTareWeightGrams: nullableInteger(source.unitTareWeightGrams),
    unitExteriorVolumeMillilitres: nullableInteger(
      source.unitExteriorVolumeMillilitres,
    ),
    rotatable: source.rotatable !== false,
    footprintsByScale: footprints,
    stack: {
      mode,
      maxQuantityPerPlacement:
        mode === "single" ? 1 : positiveInteger(stack.maxQuantityPerPlacement),
    },
  };
}

export function gridStorageInteriorSpace(
  system: Record<string, unknown>,
  ownerActorUuid: string,
  instanceId: string,
): D6StorageSpaceV1 | undefined {
  const source = record(system.storageInterior);
  if (source.configured !== true) return undefined;
  const scaleId = nonempty(source.scaleId);
  const label = nonempty(source.label);
  if (!scaleId || !label) return undefined;
  return {
    id: `container:${instanceId}`,
    label,
    kind: "container",
    ownerActorUuid,
    configuration: "grid",
    access:
      source.access === "closed" || source.access === "locked"
        ? source.access
        : "open",
    grid: {
      version: 1,
      scaleId,
      scaleLabel: nonempty(source.scaleLabel) ?? scaleId,
      columns: positiveInteger(source.columns),
      rows: positiveInteger(source.rows),
      cellWidthMm: positiveInteger(source.cellWidthMm),
      cellDepthMm: positiveInteger(source.cellDepthMm),
    },
    interiorHeightMm: nullableInteger(source.interiorHeightMm),
    limits: {
      maxAggregateWeightGrams: nullableInteger(source.maxAggregateWeightGrams),
      maxOccupiedVolumeMillilitres: nullableInteger(
        source.maxOccupiedVolumeMillilitres,
      ),
      maxDirectChildren: nullableInteger(source.maxDirectChildren),
    },
  };
}

export function gridStorageInteriorSystem(
  space: D6StorageSpaceV1 | undefined,
): Record<string, unknown> {
  if (!space?.grid)
    return {
      version: 1,
      configured: false,
      interiorHeightMm: null,
      label: "",
      scaleId: "",
      scaleLabel: "",
      columns: 1,
      rows: 1,
      cellWidthMm: 100,
      cellDepthMm: 100,
      maxAggregateWeightGrams: null,
      maxOccupiedVolumeMillilitres: null,
      maxDirectChildren: null,
      access: "open",
    };
  return {
    version: 1,
    configured: true,
    interiorHeightMm: space.interiorHeightMm ?? null,
    label: space.label,
    scaleId: space.grid.scaleId,
    scaleLabel: space.grid.scaleLabel,
    columns: space.grid.columns,
    rows: space.grid.rows,
    cellWidthMm: space.grid.cellWidthMm,
    cellDepthMm: space.grid.cellDepthMm,
    maxAggregateWeightGrams: space.limits.maxAggregateWeightGrams,
    maxOccupiedVolumeMillilitres: space.limits.maxOccupiedVolumeMillilitres,
    maxDirectChildren: space.limits.maxDirectChildren,
    access: space.access,
  };
}

export function gridStorageItemParticipates(
  item: FoundryItemDocument,
): boolean {
  return (
    GRID_STORAGE_ITEM_TYPES.includes(
      item.type as (typeof GRID_STORAGE_ITEM_TYPES)[number],
    ) && nonempty(record(item.system).storageInstanceId) !== null
  );
}

export async function gridStorageObjectFromItem(
  item: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  },
  location: D6StorageLocationV1,
): Promise<D6StorageObjectV1> {
  const instanceId = nonempty(record(item.system).storageInstanceId);
  if (!instanceId || !gridStorageItemParticipates(item))
    throw new TypeError("D6E2.Storage.Error.MissingIdentity");
  const source = structuredClone(item.toObject()) as unknown as Record<
    string,
    unknown
  >;
  const interior = gridStorageInteriorSpace(
    item.system,
    item.parent.uuid,
    instanceId,
  );
  return {
    version: 1,
    definition: {
      version: 1,
      instanceId,
      physical: gridStoragePhysicalProfile(item.system),
      ...(interior ? { interior } : {}),
    },
    documentUuid: item.uuid,
    ownerActorUuid: item.parent.uuid,
    quantity: exactPositiveQuantity(record(item.system).quantity),
    witness: await gridStorageDocumentWitness(source),
    location,
  };
}

export async function planGridStorageQuantityWrite(
  item: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  },
  targetQuantity: number,
  disposition: D6StorageLocationV1["disposition"],
): Promise<D6StorageWriteV1> {
  const source = structuredClone(item.toObject()) as Record<string, unknown>;
  const before = await documentImage(item.uuid, item.parent.uuid, source);
  const system = record(source.system);
  if (targetQuantity === 0) {
    system.storageInstanceId = "";
    system.quantity = 0;
    applyDispositionMirrors(system, "carried");
  } else {
    system.quantity = targetQuantity;
    applyDispositionMirrors(system, disposition);
  }
  source.system = system;
  const after = await documentImage(item.uuid, item.parent.uuid, source);
  return {
    sequence: 0,
    kind: "update",
    documentUuid: item.uuid,
    before,
    after,
    state: "planned",
  };
}

function documentImage(
  documentUuid: string,
  parentActorUuid: string,
  source: Readonly<Record<string, unknown>>,
): Promise<D6StorageDocumentImageV1> {
  return gridStorageDocumentWitness(source).then((witness) => ({
    documentUuid,
    parentActorUuid,
    source: structuredClone(source),
    witness,
  }));
}

function sourceWith(
  original: Record<string, unknown>,
  documentId: string,
  instanceId: string,
  quantity: number,
  disposition: D6StorageLocationV1["disposition"],
): Record<string, unknown> {
  const source = structuredClone(original);
  source._id = documentId;
  const system = record(source.system);
  system.storageInstanceId = instanceId;
  system.quantity = quantity;
  applyDispositionMirrors(system, disposition);
  source.system = system;
  return source;
}

export async function planGridStorageDocumentWrites(input: {
  readonly item: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  };
  readonly destinationActorUuid: string;
  readonly destinationDisposition: D6StorageLocationV1["disposition"];
  readonly quantity: number;
  readonly reservedInstanceId?: string;
  readonly reservedDocumentId?: string;
}): Promise<{
  readonly reservedIdentities: readonly D6StorageReservedIdentityV1[];
  readonly writes: readonly D6StorageWriteV1[];
  readonly movedInstanceId: string;
  readonly movedDocumentUuid: string;
}> {
  const original = structuredClone(input.item.toObject()) as unknown as Record<
    string,
    unknown
  >;
  const system = record(original.system);
  const sourceQuantity = exactPositiveQuantity(system.quantity);
  const sourceInstanceId = nonempty(system.storageInstanceId);
  if (
    !sourceInstanceId ||
    input.quantity < 1 ||
    input.quantity > sourceQuantity
  )
    throw new TypeError("D6E2.Storage.Error.InvalidQuantity");
  const crossOwner = input.destinationActorUuid !== input.item.parent.uuid;
  const partial = input.quantity !== sourceQuantity;
  if (partial && currencyWalletBlocksHolderRemoval(input.item))
    throw new TypeError("D6E2.Storage.Currency.Error.FundedSplit");
  const requiresNewDocument = crossOwner || partial;
  const movedInstanceId = partial
    ? (input.reservedInstanceId ?? foundryRandomId())
    : sourceInstanceId;
  const movedDocumentId = requiresNewDocument
    ? (input.reservedDocumentId ?? foundryRandomId(16))
    : input.item.id;
  const movedDocumentUuid = requiresNewDocument
    ? `${input.destinationActorUuid}.Item.${movedDocumentId}`
    : input.item.uuid;
  const reservedIdentities: D6StorageReservedIdentityV1[] = requiresNewDocument
    ? [
        {
          instanceId: movedInstanceId,
          parentActorUuid: input.destinationActorUuid,
          documentId: movedDocumentId,
          documentUuid: movedDocumentUuid,
        },
      ]
    : [];
  const writes: D6StorageWriteV1[] = [];
  if (requiresNewDocument) {
    const created = sourceWith(
      original,
      movedDocumentId,
      movedInstanceId,
      input.quantity,
      input.destinationDisposition,
    );
    writes.push({
      sequence: writes.length,
      kind: "create",
      documentUuid: movedDocumentUuid,
      before: null,
      after: await documentImage(
        movedDocumentUuid,
        input.destinationActorUuid,
        created,
      ),
      state: "planned",
    });
    if (partial) {
      const remaining = sourceWith(
        original,
        input.item.id,
        sourceInstanceId,
        sourceQuantity - input.quantity,
        record(system).equipped === true ? "equipped" : "carried",
      );
      writes.push({
        sequence: writes.length,
        kind: "update",
        documentUuid: input.item.uuid,
        before: await documentImage(
          input.item.uuid,
          input.item.parent.uuid,
          original,
        ),
        after: await documentImage(
          input.item.uuid,
          input.item.parent.uuid,
          remaining,
        ),
        state: "planned",
      });
    } else {
      writes.push({
        sequence: writes.length,
        kind: "delete",
        documentUuid: input.item.uuid,
        before: await documentImage(
          input.item.uuid,
          input.item.parent.uuid,
          original,
        ),
        after: null,
        state: "planned",
      });
    }
  } else {
    const updated = sourceWith(
      original,
      input.item.id,
      sourceInstanceId,
      sourceQuantity,
      input.destinationDisposition,
    );
    if (canonical(updated) !== canonical(original))
      writes.push({
        sequence: 0,
        kind: "update",
        documentUuid: input.item.uuid,
        before: await documentImage(
          input.item.uuid,
          input.item.parent.uuid,
          original,
        ),
        after: await documentImage(
          input.item.uuid,
          input.item.parent.uuid,
          updated,
        ),
        state: "planned",
      });
  }
  return { reservedIdentities, writes, movedInstanceId, movedDocumentUuid };
}
