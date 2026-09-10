import { requireDestinyValue } from "@d6-system-2e/core";
import { beforeEach, describe, it, expect, vi } from "vitest";
import type {
  D6DestinyDeliveryV1,
  D6DestinyProposalV1,
} from "@d6-system-2e/core";
import {
  recoverDestinyEquipmentDelivery,
  newDestinyItemId,
  cleanupDestinyEquipment,
  deliverDestinyEquipment,
  destinyItemFingerprint,
  destinyDeliverySource,
  previewDestinyDelivery,
} from "./destiny-equipment";

const scope = "d6-system-2e";
class ItemDocument {
  source: Record<string, unknown>;
  constructor(source: Record<string, unknown>) {
    this.source = {
      img: "icons/default.svg",
      ownership: { default: 0 },
      ...structuredClone(source),
      _stats: { createdTime: 1 },
    };
  }
  get id() {
    return String(this.source._id);
  }
  get type() {
    return String(this.source.type);
  }
  get name() {
    return String(this.source.name);
  }
  get system() {
    return this.source.system;
  }
  readonly documentName = "Item";
  toObject() {
    return structuredClone(this.source);
  }
  updateSource(changes: Record<string, unknown>) {
    Object.assign(this.source, changes);
  }
  getFlag(namespace: string, key: string) {
    const flags = this.source.flags as
      Record<string, Record<string, unknown>> | undefined;
    return flags?.[namespace]?.[key];
  }
}
function fixture() {
  const items = new Map<string, ItemDocument>();
  const actor = {
    id: "hero",
    items: { get: (id: string) => items.get(id) },
    createEmbeddedDocuments: vi.fn(
      async (
        _kind: string,
        sources: Record<string, unknown>[],
        options: unknown,
      ) => {
        await Promise.resolve();
        expect(options).toEqual({ keepId: true });
        return sources.map((source) => {
          if (!/^[A-Za-z0-9]{16}$/.test(String(source._id)))
            throw new Error("_id must be a valid 16-character alphanumeric ID");
          // Foundry adds the creating user's OWNER entry after construction.
          const item = new ItemDocument({
            ...source,
            ownership: {
              ...(source.ownership as Record<string, number>),
              creator: 3,
            },
          });
          items.set(item.id, item);
          return item;
        });
      },
    ),
    deleteEmbeddedDocuments: vi.fn(async (_kind: string, ids: string[]) => {
      await Promise.resolve();
      ids.forEach((id) => items.delete(id));
    }),
  };
  vi.stubGlobal("game", {
    version: "14.367",
    user: { id: "creator", isGM: true },
    system: { version: "beta20" },
    actors: { get: (id: string) => (id === "hero" ? actor : undefined) },
  });
  vi.stubGlobal("Item", ItemDocument);
  const randomId = vi.fn((length: number) => "A".repeat(length));
  vi.stubGlobal("foundry", {
    utils: {
      randomID: randomId,
      cleanHTML: (s: string) => s.replace(/<script.*?<\/script>/g, ""),
    },
  });
  return { actor, items, randomId };
}
const definition: D6DestinyDeliveryV1 = {
  kind: "equipment",
  actorId: "hero",
  itemId: "DestinyItem00001",
  name: "Prepared kit",
  description: "One bounded kit",
  quantity: 2,
  charges: 3,
  permanence: "session",
};
function proposal(delivery: D6DestinyDeliveryV1): D6DestinyProposalV1 {
  return {
    id: "proposal",
    userId: "player",
    actorId: "hero",
    coinId: "coin-1",
    story: "Packed before leaving",
    situation: "",
    request: "Kit",
    review: "Approved",
    status: "delivering",
    delivery,
  };
}
describe("Destiny equipment delivery and cleanup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  it("generates native IDs and rejects invalid previews before delivery", async () => {
    const f = fixture();
    expect(newDestinyItemId()).toBe("A".repeat(16));
    expect(f.randomId).toHaveBeenCalledWith(16);
    await expect(
      previewDestinyDelivery({
        ...definition,
        kind: "equipment",
        itemId: "A".repeat(24),
      }),
    ).rejects.toThrow("InvalidEquipment");
    expect(f.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });
  it("recovers committed legacy IDs deterministically across an interrupted ledger acknowledgment", async () => {
    const f = fixture();
    const reviewed = await previewDestinyDelivery(definition);
    if (reviewed.kind !== "equipment") throw new Error("Expected equipment");
    const legacy = proposal({
      ...reviewed,
      kind: "equipment",
      itemId: "Jx0DbKSKQFjWW2bfp3Ch4XNj",
    });
    const recovered = recoverDestinyEquipmentDelivery(legacy);
    expect(recovered.delivery).toMatchObject({ itemId: "Jx0DbKSKQFjWW2bf" });
    expect(legacy.delivery).toMatchObject({
      itemId: "Jx0DbKSKQFjWW2bfp3Ch4XNj",
    });
    const fingerprint = await deliverDestinyEquipment(
      "session",
      recovered,
      () => undefined,
    );
    expect(
      await deliverDestinyEquipment(
        "session",
        recoverDestinyEquipmentDelivery(legacy),
        () => undefined,
      ),
    ).toBe(fingerprint);
    expect(f.actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(f.items.size).toBe(1);
    expect(
      await cleanupDestinyEquipment(
        "session",
        {
          ...recovered,
          status: "approved",
          itemFingerprint: requireDestinyValue(fingerprint),
        },
        () => undefined,
      ),
    ).toBe("removed");
    f.items.set(
      "Jx0DbKSKQFjWW2bf",
      new ItemDocument({ _id: "Jx0DbKSKQFjWW2bf", type: "gear" }),
    );
    await expect(
      deliverDestinyEquipment("session", recovered, () => undefined),
    ).rejects.toThrow("DeliveryConflict");
  });
  it("materializes the exact quantity/charges/permanence once and cleans up the unchanged grant", async () => {
    const f = fixture();
    const p = proposal(await previewDestinyDelivery(definition));
    const fingerprint = await deliverDestinyEquipment("session", p, () => {
      return undefined;
    });
    expect(f.items.get("DestinyItem00001")?.system).toMatchObject({
      quantity: 2,
    });
    expect(
      f.items.get("DestinyItem00001")?.getFlag(scope, "destinyEquipment"),
    ).toMatchObject({
      version: 1,
      charges: 3,
      quantity: 2,
      permanence: "session",
      sessionId: "session",
      proposalId: "proposal",
      fingerprint,
    });
    expect(
      await deliverDestinyEquipment("session", p, () => {
        return undefined;
      }),
    ).toBe(fingerprint);
    expect(f.actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(
      await cleanupDestinyEquipment(
        "session",
        {
          ...p,
          status: "approved",
          itemFingerprint: requireDestinyValue(fingerprint),
        },
        () => {
          return undefined;
        },
      ),
    ).toBe("removed");
    expect(f.items.size).toBe(0);
  });
  it("fingerprints native creator ownership before creation and protects later permission edits", async () => {
    const f = fixture();
    const p = proposal(await previewDestinyDelivery(definition));
    const fingerprint = await deliverDestinyEquipment(
      "session",
      p,
      () => undefined,
    );
    const persisted = requireDestinyValue(f.items.get("DestinyItem00001"));
    expect(persisted.toObject().ownership).toEqual({ default: 0, creator: 3 });
    expect(await destinyItemFingerprint(persisted.toObject())).toBe(
      fingerprint,
    );
    persisted.source.ownership = { default: 0, creator: 3, player: 2 };
    expect(await deliverDestinyEquipment("session", p, () => undefined)).toBe(
      fingerprint,
    );
    expect(
      await cleanupDestinyEquipment(
        "session",
        {
          ...p,
          status: "approved",
          itemFingerprint: requireDestinyValue(fingerprint),
        },
        () => undefined,
      ),
    ).toBe("retained");
    expect(f.actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(f.actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });
  it("retains edited grants and does not recreate a delivered Item on retry", async () => {
    const f = fixture();
    const p = proposal(await previewDestinyDelivery(definition));
    const fingerprint = await deliverDestinyEquipment("session", p, () => {
      return undefined;
    });
    requireDestinyValue(f.items.get("DestinyItem00001")).source.name =
      "Player renamed this";
    expect(
      await deliverDestinyEquipment("session", p, () => {
        return undefined;
      }),
    ).toBe(fingerprint);
    expect(
      await cleanupDestinyEquipment(
        "session",
        {
          ...p,
          status: "approved",
          itemFingerprint: requireDestinyValue(fingerprint),
        },
        () => {
          return undefined;
        },
      ),
    ).toBe("retained");
    expect(f.actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
    expect(f.actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
  });
  it("replaces unrelated catalog ammunition with approved charges and invalidates a changed source", async () => {
    fixture();
    const catalog = new ItemDocument({
      _id: "catalog",
      name: "Pistol",
      type: "weapon",
      system: {
        quantity: 12,
        damage: 6,
        ammunition: { current: 99, maximum: 99 },
      },
      flags: { external: { macro: "unapproved" } },
      effects: [{ name: "unapproved effect" }],
    });
    vi.stubGlobal(
      "fromUuid",
      vi.fn(async () => await Promise.resolve(catalog)),
    );
    const approved = await previewDestinyDelivery({
      ...definition,
      kind: "equipment",
      sourceUuid: "Item.catalog",
      permanence: "permanent",
      charges: 2,
    });
    expect(await destinyDeliverySource(approved)).toMatchObject({
      system: { quantity: 2, ammunition: { current: 2, maximum: 2 } },
      effects: [],
      flags: {},
    });
    (catalog.source.system as Record<string, unknown>).damage = 99;
    await expect(destinyDeliverySource(approved)).rejects.toThrow(
      "EquipmentChanged",
    );
  });
  it("does not create fiction-only equipment, rejects collisions and reports missing/transferred grants", async () => {
    const f = fixture();
    expect(
      await deliverDestinyEquipment(
        "session",
        proposal({ kind: "fact", fact: "Preparation established" }),
        () => {
          return undefined;
        },
      ),
    ).toBeUndefined();
    expect(f.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    f.items.set(
      "DestinyItem00001",
      new ItemDocument({
        _id: "DestinyItem00001",
        type: "gear",
        name: "Existing user gear",
        system: {},
      }),
    );
    await expect(
      deliverDestinyEquipment("session", proposal(definition), () => {
        return undefined;
      }),
    ).rejects.toThrow("DeliveryConflict");
    f.items.delete("DestinyItem00001");
    expect(
      await cleanupDestinyEquipment("session", proposal(definition), () => {
        return undefined;
      }),
    ).toBe("missing");
  });
});
