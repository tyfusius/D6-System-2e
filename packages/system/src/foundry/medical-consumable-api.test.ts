import { MODEL_B_STIM_EFFECT_ID } from "@d6-system-2e/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginMedicalConsumableUse,
  readMedicalConsumables,
} from "./medical-consumable-api";

const f = vi.hoisted(() => ({
  enabled: true,
  availability: vi.fn(),
  require: vi.fn(),
  open: vi.fn(),
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    homebrew: { tyfusiusMedicalConsumables: f.enabled },
  }),
}));
vi.mock("./grid-storage-availability", () => ({
  gridStorageAvailabilityForItems: f.availability,
  requireGridStorageItemAction: f.require,
}));
vi.mock("./medical-consumable-dialog", () => ({
  openMedicalConsumableUseDialog: f.open,
}));

function fixture(uuid = "Actor.owner") {
  const item = {
    id: "stim",
    name: "Stim",
    img: "stim.webp",
    type: "gear",
    parent: { uuid },
    system: {
      equipped: false,
      quantity: 2,
      gearCategory: "medical-consumable",
      medicalConsumable: {
        version: 1,
        effectId: MODEL_B_STIM_EFFECT_ID,
        compatibility: "biological",
        treatmentFamily: "none",
        actionCost: 1,
        doseCost: 1,
        duration: { dice: 1, faces: 6, unit: "rounds" },
      },
    },
  };
  const actor = {
    uuid,
    items: {
      contents: [item],
      get: (id: string) => (id === item.id ? item : undefined),
    },
    testUserPermission: vi.fn(() => true),
  };
  return { actor, item };
}
beforeEach(() => {
  vi.clearAllMocks();
  f.enabled = true;
  f.availability.mockImplementation((items: FoundryItemDocument[]) =>
    Promise.resolve(new Map(items.map((item) => [item, { canUse: true }]))),
  );
  f.require.mockResolvedValue({ canUse: true });
  vi.stubGlobal("game", { user: { id: "owner", active: true, isGM: false } });
});
afterEach(() => vi.unstubAllGlobals());

describe("public medical consumable API", () => {
  it("projects carried doses without requiring equipped status or patient injury", async () => {
    const { actor } = fixture();
    expect(await readMedicalConsumables(actor)).toEqual([
      {
        id: "stim",
        name: "Stim",
        image: "stim.webp",
        quantity: 2,
        actionCost: 1,
        doseCost: 1,
      },
    ]);
  });
  it.each(["Actor.owner", "Scene.qa.Token.synthetic.Actor.owner"])(
    "routes the original owned item and exact actor UUID %s",
    async (uuid) => {
      const { actor, item } = fixture(uuid);
      await readMedicalConsumables(actor);
      await beginMedicalConsumableUse(actor, item.id);
      expect(f.availability).toHaveBeenCalledWith([item], uuid);
      expect(f.require).toHaveBeenCalledWith(item, uuid, "use");
      expect(f.open).toHaveBeenCalledExactlyOnceWith(item);
      expect(item.system.quantity).toBe(2);
    },
  );
  it.each([0, -1, 1.5, NaN])(
    "omits unusable quantity %s and rejects stale invocation",
    async (quantity) => {
      const { actor, item } = fixture();
      item.system.quantity = quantity;
      expect(await readMedicalConsumables(actor)).toEqual([]);
      await expect(beginMedicalConsumableUse(actor, item.id)).rejects.toThrow(
        "Unavailable",
      );
      expect(f.open).not.toHaveBeenCalled();
    },
  );
  it("does not expose unsupported treatments", async () => {
    const { actor, item } = fixture();
    item.system.medicalConsumable.duration.dice = 2;
    expect(await readMedicalConsumables(actor)).toEqual([]);
    await expect(beginMedicalConsumableUse(actor, item.id)).rejects.toThrow(
      "Unavailable",
    );
  });
  it("omits inaccessible doses and rechecks storage on invocation", async () => {
    const { actor, item } = fixture();
    f.availability.mockImplementation((items: FoundryItemDocument[]) =>
      Promise.resolve(new Map(items.map((item) => [item, { canUse: false }]))),
    );
    expect(await readMedicalConsumables(actor)).toEqual([]);
    f.require.mockRejectedValue(new Error("D6E2.Storage.Error.Unavailable"));
    await expect(beginMedicalConsumableUse(actor, item.id)).rejects.toThrow(
      "Storage",
    );
    expect(f.open).not.toHaveBeenCalled();
  });
  it("fails closed when the storage authority cannot answer", async () => {
    f.availability.mockRejectedValue(new Error("offline"));
    expect(await readMedicalConsumables(fixture().actor)).toEqual([]);
  });
  it.each(["rule", "permission", "inactive", "missing", "wrong-parent"])(
    "revalidates %s before opening",
    async (reason) => {
      const { actor, item } = fixture();
      if (reason === "rule") f.enabled = false;
      if (reason === "permission")
        actor.testUserPermission.mockReturnValue(false);
      if (reason === "inactive")
        vi.stubGlobal("game", { user: { active: false, isGM: true } });
      if (reason === "wrong-parent") item.parent.uuid = "Actor.someone-else";
      await expect(
        beginMedicalConsumableUse(
          actor,
          reason === "missing" ? "gone" : item.id,
        ),
      ).rejects.toThrow();
      expect(f.open).not.toHaveBeenCalled();
      if (["rule", "permission", "inactive"].includes(reason))
        expect(await readMedicalConsumables(actor)).toEqual([]);
    },
  );
});

it("uses one availability read for eight doses and rechecks ownership after waiting", async () => {
  const { actor, item } = fixture();
  const items = Array.from({ length: 8 }, (_, i) => ({
    ...item,
    id: `dose-${i}`,
  }));
  actor.items.contents = items;
  actor.items.get = (id: string) => items.find((entry) => entry.id === id);
  expect(await readMedicalConsumables(actor)).toHaveLength(8);
  expect(f.availability).toHaveBeenCalledOnce();
  f.availability.mockImplementationOnce(
    async (candidates: FoundryItemDocument[]) => {
      actor.testUserPermission.mockReturnValue(false);
      return Promise.resolve(
        new Map(candidates.map((candidate) => [candidate, { canUse: true }])),
      );
    },
  );
  expect(await readMedicalConsumables(actor)).toEqual([]);
});
