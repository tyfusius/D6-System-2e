import type { D6StorageDisposition } from "@d6-system-2e/core";
import {
  requestGridStorageOperation,
  requestGridStorageProjection,
} from "./grid-storage-authority.js";
import { foundryRandomId } from "./foundry-random-id.js";

export async function setGridStorageItemDisposition(
  actor: FoundryActorDocument & { readonly uuid: string },
  instanceId: string,
  disposition: D6StorageDisposition,
  suppliedProjection?: Awaited<ReturnType<typeof requestGridStorageProjection>>,
): Promise<boolean> {
  if (!instanceId) return false;
  const projection =
    suppliedProjection ??
    (await requestGridStorageProjection({ actorUuid: actor.uuid }));
  const object = projection.objects[instanceId];
  if (!object) return false;
  if (disposition === "installed" && object.location.state === "unplaced")
    return false;
  if (
    object.location.disposition !== "equipped" &&
    object.ownerActorUuid !== actor.uuid
  )
    return false;
  const revision = projection.workspace?.revision;
  if (revision === null || revision === undefined) return false;
  const location = object.location;
  const result = await requestGridStorageOperation({
    kind: "move",
    value: {
      version: 1,
      operationId: foundryRandomId(),
      baseRevision: revision,
      instanceId,
      quantity: "all",
      destination: location.state === "unplaced" ? null : location.parent,
      rectangle: location.state === "placed" ? location.rectangle : null,
      disposition,
      pinned: location.state === "unplaced" ? false : location.pinned,
      ownershipTransfer: {
        mode: "preserve",
        targetOwnerActorUuid: null,
        scope: "object-only",
      },
      witnesses: { [instanceId]: object.witness },
    },
  });
  if (result.status !== "completed")
    throw new Error(
      result.issue === "stale"
        ? "D6E2.Storage.Error.Stale"
        : "D6E2.Storage.Error.Unavailable",
    );
  return true;
}

export async function requireGridStorageInstalledDestination(
  actor: FoundryActorDocument & { readonly uuid: string },
  instanceId: string,
): Promise<void> {
  if (!instanceId) throw new Error("D6E2.Storage.Error.MissingIdentity");
  const projection = await requestGridStorageProjection({
    actorUuid: actor.uuid,
  });
  const object = projection.objects[instanceId];
  if (!object || object.location.state === "unplaced")
    throw new Error("D6E2.Storage.Error.DestinationUnavailable");
}

export async function setGridStorageItemQuantity(
  actor: FoundryActorDocument & { readonly uuid: string },
  instanceId: string,
  targetQuantity: number,
  operationId = foundryRandomId(),
): Promise<boolean> {
  if (!instanceId) return false;
  const projection = await requestGridStorageProjection({
    actorUuid: actor.uuid,
  });
  const object = projection.objects[instanceId];
  const revision = projection.workspace?.revision;
  if (!object || revision === null || revision === undefined) return false;
  const result = await requestGridStorageOperation({
    kind: "quantity",
    value: {
      version: 1,
      operationId,
      baseRevision: revision,
      instanceId,
      actingActorUuid: actor.uuid,
      targetQuantity,
      witnesses: { [instanceId]: object.witness },
    },
  });
  if (result.status !== "completed")
    throw new Error(
      result.issue === "stale"
        ? "D6E2.Storage.Error.Stale"
        : "D6E2.Storage.Error.Unavailable",
    );
  return true;
}
