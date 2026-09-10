import { requireDestinyValue } from "@d6-system-2e/core";
import { foundryRandomId } from "./foundry-random-id";
import schemaVersion from "../../../../schema-version.json";
import { initializeItemDefaultImage } from "./document-default-images";
import {
  validateDestinyDelivery,
  type D6DestinyDeliveryV1,
  type D6DestinyProposalV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { record } from "./sheets/values";

const nativeItemId = /^[A-Za-z0-9]{16}$/;

export function newDestinyItemId(): string {
  const id = foundryRandomId(16);
  if (!nativeItemId.test(id))
    throw new Error("D6E2.Destiny.Error.InvalidEquipment");
  return id;
}

/** Recover the known pre-fix 24-character ID without repeating its committed spend.
 * The deterministic ID survives a crash after Item creation but before ledger ack.
 * Existing native receipt checks still reject unrelated Items at the repaired ID.
 */
export function recoverDestinyEquipmentDelivery(
  proposal: D6DestinyProposalV1,
): D6DestinyProposalV1 {
  const delivery = proposal.delivery;
  if (
    proposal.status !== "delivering" ||
    delivery?.kind !== "equipment" ||
    nativeItemId.test(delivery.itemId)
  )
    return proposal;
  if (!/^[A-Za-z0-9]{24}$/.test(delivery.itemId))
    throw new Error("D6E2.Destiny.Error.InvalidEquipment");
  return {
    ...proposal,
    delivery: { ...delivery, itemId: delivery.itemId.slice(0, 16) },
  };
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, stable(entry)]),
    );
  return value;
}
/** Ignore only native lifecycle metadata and the fingerprint's own field. */
export async function destinyItemFingerprint(
  source: Record<string, unknown>,
): Promise<string> {
  const value = structuredClone(source);
  delete value._stats;
  const flags = record(value.flags);
  const system = record(flags[SYSTEM_ID]);
  const marker = record(system.destinyEquipment);
  if (system.destinyEquipment) {
    delete marker.fingerprint;
    system.destinyEquipment = marker;
    flags[SYSTEM_ID] = system;
    value.flags = flags;
  }
  const data = new TextEncoder().encode(JSON.stringify(stable(value)));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

export async function destinyDeliverySource(
  delivery: D6DestinyDeliveryV1,
): Promise<Record<string, unknown> | null> {
  validateDestinyDelivery(delivery);
  if (delivery.kind === "fact") return null;
  if (!nativeItemId.test(delivery.itemId))
    throw new Error("D6E2.Destiny.Error.InvalidEquipment");
  if (!game.actors?.get(delivery.actorId))
    throw new Error("D6E2.Destiny.Error.ActorMissing");
  let source: Record<string, unknown> = {
    name: delivery.name,
    type: "gear",
    system: {
      description: foundry.utils.cleanHTML(delivery.description),
      quantity: delivery.quantity,
    },
    effects: [],
    flags: {},
  };
  if (delivery.sourceUuid) {
    const item = (await fromUuid(delivery.sourceUuid)) as
      (FoundryItemDocument & { documentName?: string }) | null;
    if (
      item?.documentName !== "Item" ||
      !["gear", "weapon", "armor"].includes(item.type)
    )
      throw new Error("D6E2.Destiny.Error.InvalidEquipment");
    const raw = item.toObject();
    // The GM chooses a native catalog/world Item's mechanical fields. Do not copy
    // arbitrary external flags, effects, ownership, folder or old provenance.
    source = {
      name: delivery.name,
      type: item.type,
      img: raw.img,
      system: { ...record(raw.system), quantity: delivery.quantity },
      effects: [],
      flags: {},
    };
  }
  if (source.type === "weapon")
    source.system = {
      ...record(source.system),
      ammunition: { current: delivery.charges, maximum: delivery.charges },
    };
  const digest = await destinyItemFingerprint(source);
  if (delivery.sourceDigest && digest !== delivery.sourceDigest)
    throw new Error("D6E2.Destiny.Error.EquipmentChanged");
  return source;
}

/** Immutable reviewed source identity; changing a catalog Item invalidates approval. */
export async function previewDestinyDelivery(
  delivery: D6DestinyDeliveryV1,
): Promise<D6DestinyDeliveryV1> {
  const source = await destinyDeliverySource(delivery);
  return delivery.kind === "fact"
    ? structuredClone(delivery)
    : {
        ...delivery,
        sourceDigest: await destinyItemFingerprint(requireDestinyValue(source)),
      };
}

export async function deliverDestinyEquipment(
  sessionId: string,
  proposal: D6DestinyProposalV1,
  requireAuthority: () => void,
): Promise<string | undefined> {
  const delivery = proposal.delivery;
  if (delivery?.kind !== "equipment") return undefined;
  const actor = game.actors?.get(delivery.actorId);
  if (!actor) throw new Error("D6E2.Destiny.Error.ActorMissing");
  const existing = actor.items.get(delivery.itemId);
  if (existing) {
    const marker = record(existing.getFlag?.(SYSTEM_ID, "destinyEquipment"));
    if (
      marker.version !== 1 ||
      marker.sessionId !== sessionId ||
      marker.proposalId !== proposal.id ||
      marker.quantity !== delivery.quantity ||
      marker.charges !== delivery.charges ||
      marker.permanence !== delivery.permanence ||
      typeof marker.fingerprint !== "string"
    )
      throw new Error("D6E2.Destiny.Error.DeliveryConflict");
    // A player's intervening edits are preserved. Creation is not repeated.
    return marker.fingerprint;
  }
  const raw = await destinyDeliverySource(delivery);
  const marker = {
    version: 1,
    sessionId,
    proposalId: proposal.id,
    quantity: delivery.quantity,
    charges: delivery.charges,
    remainingCharges: delivery.charges,
    permanence: delivery.permanence,
  };
  const data = {
    ...raw,
    system: {
      ...record(raw?.system),
      _migration: {
        foundry: game.version ?? "",
        system: game.system.version ?? "",
        schema: schemaVersion.latest,
      },
    },
    _id: delivery.itemId,
    // Native creation grants the creating user OWNER after construction. Include
    // that default before hashing, while preserving later ownership edit checks.
    ownership: { default: 0, [requireDestinyValue(game.user).id]: 3 },
    flags: { [SYSTEM_ID]: { destinyEquipment: marker } },
  };
  // Materialize native schema defaults before hashing, so reload normalization
  // cannot make an untouched temporary Item look like a user edit.
  const ItemClass = Item as unknown as new (
    data: Record<string, unknown>,
    context: { parent: FoundryActorDocument },
  ) => FoundryItemDocument;
  const document = new ItemClass(data, { parent: actor });
  initializeItemDefaultImage(document, data);
  const normalized = document.toObject();
  const fingerprint = await destinyItemFingerprint(normalized);
  requireAuthority();
  await actor.createEmbeddedDocuments(
    "Item",
    [
      {
        ...normalized,
        flags: {
          [SYSTEM_ID]: { destinyEquipment: { ...marker, fingerprint } },
        },
      },
    ],
    { keepId: true },
  );
  return fingerprint;
}

/** Remove only the exact unchanged session grant. Keep edited/transferred Items for review. */
export async function cleanupDestinyEquipment(
  sessionId: string,
  proposal: D6DestinyProposalV1,
  requireAuthority: () => void,
): Promise<"removed" | "retained" | "missing"> {
  const delivery = proposal.delivery;
  if (delivery?.kind !== "equipment")
    throw new Error("D6E2.Destiny.Error.InvalidEquipment");
  const actor = game.actors?.get(delivery.actorId);
  const item = actor?.items.get(delivery.itemId);
  if (!actor || !item) return "missing";
  const marker = record(item.getFlag?.(SYSTEM_ID, "destinyEquipment"));
  if (
    marker.version !== 1 ||
    marker.sessionId !== sessionId ||
    marker.proposalId !== proposal.id ||
    !proposal.itemFingerprint ||
    (await destinyItemFingerprint(item.toObject())) !== proposal.itemFingerprint
  )
    return "retained";
  requireAuthority();
  await actor.deleteEmbeddedDocuments("Item", [delivery.itemId]);
  return "removed";
}
