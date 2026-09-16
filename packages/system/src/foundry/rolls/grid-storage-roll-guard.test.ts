import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D6StorageAvailability } from "@d6-system-2e/core";

const f = vi.hoisted(() => ({
  availability: vi.fn(),
  explosive: vi.fn(() => Promise.resolve(null)),
  warn: vi.fn(),
}));

vi.mock("../grid-storage-authority.js", () => ({
  requestGridStorageAvailability: (actorUuid: string, instanceId: string) =>
    f.availability(actorUuid, instanceId) as Promise<D6StorageAvailability>,
}));
vi.mock("../explosives/explosive-service", () => ({
  beginD6ThrownExplosiveThrow: f.explosive,
}));

import { rollItem } from "./roll-service.js";

function weapon(
  id: string,
  type: "weapon" | "starship-weapon" | "vehicle-weapon",
  storageInstanceId: string,
): FoundryItemDocument {
  return {
    id,
    name: id,
    type,
    system: {
      storageInstanceId,
      weaponKind: type === "weapon" ? "thrown-explosive" : "",
    },
  } as unknown as FoundryItemDocument;
}

function actor(
  type: "character" | "starship" | "vehicle",
  item: FoundryItemDocument,
): FoundryActorDocument {
  return {
    id: `${type}-actor`,
    uuid: `Actor.${type}`,
    name: type,
    type,
    system: { crew: {} },
    items: {
      get: (id: string) => (id === item.id ? item : undefined),
      contents: [item],
    },
  } as unknown as FoundryActorDocument;
}

beforeEach(() => {
  f.availability.mockReset().mockResolvedValue({
    configured: true,
    reachable: false,
    canUse: false,
    canEquip: false,
    effectiveEquipped: false,
    effectiveInstalled: false,
  });
  f.explosive.mockClear();
  f.warn.mockClear();
  vi.stubGlobal("game", {
    actors: { get: () => undefined },
    i18n: { localize: (key: string) => key },
  });
  vi.stubGlobal("ui", { notifications: { warn: f.warn } });
});

describe("public weapon roll grid-storage guard", () => {
  it("preserves legacy personal and machine weapons without a storage identity", async () => {
    const personalWeapon = weapon("grenade", "weapon", "");
    await expect(
      rollItem(actor("character", personalWeapon), personalWeapon.id),
    ).resolves.toBeNull();
    expect(f.explosive).toHaveBeenCalledTimes(1);
    expect(f.availability).not.toHaveBeenCalled();

    for (const [machineType, weaponType] of [
      ["vehicle", "vehicle-weapon"],
      ["starship", "starship-weapon"],
    ] as const) {
      const machineWeapon = weapon(`${machineType}-gun`, weaponType, "");
      await expect(
        rollItem(actor(machineType, machineWeapon), machineWeapon.id),
      ).resolves.toBeNull();
    }
    expect(f.warn).toHaveBeenCalledTimes(2);
    expect(f.availability).not.toHaveBeenCalled();
  });

  it.each(["remote", "inaccessible", "installed"])(
    "rejects a participating %s weapon before the public roll path continues",
    async (state) => {
      const participating = weapon(state, "weapon", state);
      await expect(
        rollItem(actor("character", participating), participating.id),
      ).rejects.toThrow("D6E2.Storage.Error.Unavailable");
      expect(f.availability).toHaveBeenCalledWith("Actor.character", state);
      expect(f.explosive).not.toHaveBeenCalled();
    },
  );

  it("does not continue a public roll for a nonempty identity missing from authority state", async () => {
    f.availability.mockResolvedValue({
      configured: false,
      reachable: true,
      canUse: true,
      canEquip: true,
      effectiveEquipped: false,
      effectiveInstalled: false,
    });
    const missing = weapon("missing", "weapon", "missing");
    await expect(
      rollItem(actor("character", missing), missing.id),
    ).rejects.toThrow("D6E2.Storage.Error.Unavailable");
    expect(f.availability).toHaveBeenCalledWith("Actor.character", "missing");
    expect(f.explosive).not.toHaveBeenCalled();
  });

  it("allows participating equipped-local personal and machine weapons", async () => {
    f.availability.mockResolvedValue({
      configured: true,
      reachable: true,
      canUse: true,
      canEquip: true,
      effectiveEquipped: true,
      effectiveInstalled: false,
    });
    const personalWeapon = weapon("local-personal", "weapon", "local-personal");
    await expect(
      rollItem(actor("character", personalWeapon), personalWeapon.id),
    ).resolves.toBeNull();
    expect(f.explosive).toHaveBeenCalledTimes(1);

    for (const [machineType, weaponType] of [
      ["vehicle", "vehicle-weapon"],
      ["starship", "starship-weapon"],
    ] as const) {
      const machineWeapon = weapon(
        `local-${machineType}`,
        weaponType,
        `local-${machineType}`,
      );
      await expect(
        rollItem(actor(machineType, machineWeapon), machineWeapon.id),
      ).resolves.toBeNull();
    }
    expect(f.availability).toHaveBeenCalledTimes(3);
    expect(f.warn).toHaveBeenCalledTimes(2);
  });
});
