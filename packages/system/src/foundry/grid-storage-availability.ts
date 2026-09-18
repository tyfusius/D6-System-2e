import { GRID_STORAGE_AVAILABILITY_BATCH_LIMIT } from "../application/grid-storage-availability-batch";
import { type D6StorageAvailability } from "@d6-system-2e/core";
import {
  requestGridStorageAvailability,
  requestGridStorageAvailabilityBatch,
} from "./grid-storage-authority.js";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const unrestricted = (): D6StorageAvailability => ({
  configured: false,
  reachable: true,
  canUse: true,
  canEquip: true,
  effectiveEquipped: false,
  effectiveInstalled: false,
});

const unavailable = (): D6StorageAvailability => ({
  configured: true,
  reachable: false,
  canUse: false,
  canEquip: false,
  effectiveEquipped: false,
  effectiveInstalled: false,
});

export async function gridStorageAvailabilityForItem(
  item: FoundryItemDocument,
  actingActorUuid: string,
): Promise<D6StorageAvailability> {
  const instanceId = record(item.system).storageInstanceId;
  if (typeof instanceId !== "string" || !instanceId) return unrestricted();
  const availability = await requestGridStorageAvailability(
    actingActorUuid,
    instanceId,
  );
  return availability.configured ? availability : unavailable();
}

/** One request-scoped authority read for each bounded group; no retained availability cache. */
export async function gridStorageAvailabilityForItems(
  items: readonly FoundryItemDocument[],
  actingActorUuid: string,
): Promise<ReadonlyMap<FoundryItemDocument, D6StorageAvailability>> {
  const ids = [
    ...new Set(
      items.flatMap((item) => {
        const id = record(item.system).storageInstanceId;
        return typeof id === "string" && id ? [id] : [];
      }),
    ),
  ];
  const values = new Map<string, D6StorageAvailability>();
  for (
    let offset = 0;
    offset < ids.length;
    offset += GRID_STORAGE_AVAILABILITY_BATCH_LIMIT
  ) {
    const batch = ids.slice(
      offset,
      offset + GRID_STORAGE_AVAILABILITY_BATCH_LIMIT,
    );
    const result: Readonly<Record<string, D6StorageAvailability>> =
      await requestGridStorageAvailabilityBatch(actingActorUuid, batch).catch(
        () => ({}),
      );
    for (const id of batch) {
      const availability = result[id];
      values.set(id, availability?.configured ? availability : unavailable());
    }
  }
  return new Map(
    items.map((item) => {
      const id = record(item.system).storageInstanceId;
      return [
        item,
        typeof id === "string" && id
          ? (values.get(id) ?? unavailable())
          : unrestricted(),
      ];
    }),
  );
}

export async function requireGridStorageItemAction(
  item: FoundryItemDocument,
  actingActorUuid: string,
  action: "use" | "equip" | "effect" | "armor" | "attack" | "installed",
): Promise<D6StorageAvailability> {
  const availability = await gridStorageAvailabilityForItem(
    item,
    actingActorUuid,
  );
  if (!availability.configured) return availability;
  const allowed =
    action === "use" || action === "effect"
      ? availability.canUse
      : action === "equip"
        ? availability.canEquip
        : action === "installed"
          ? availability.effectiveInstalled
          : availability.effectiveEquipped;
  if (!allowed) throw new Error("D6E2.Storage.Error.Unavailable");
  return availability;
}

export async function effectiveGridStorageArmorItemIds(
  actor: FoundryActorDocument & { readonly uuid: string },
): Promise<ReadonlySet<string>> {
  const effective = new Set<string>();
  for (const item of actor.items.contents.filter(
    (candidate) =>
      candidate.type === "armor" && candidate.system.equipped === true,
  )) {
    const availability = await gridStorageAvailabilityForItem(item, actor.uuid);
    if (!availability.configured || availability.effectiveEquipped)
      effective.add(item.id);
  }
  return effective;
}
