import { type D6StorageAvailability } from "@d6-system-2e/core";
import { requestGridStorageAvailability } from "./grid-storage-authority.js";

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
