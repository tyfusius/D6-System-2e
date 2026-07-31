import { afterEach, describe, expect, it } from "vitest";
import {
  equipmentCatalogRegistry,
  resetEquipmentCatalogRegistryForTests,
} from "./equipment";

afterEach(resetEquipmentCatalogRegistryForTests);

describe("equipment catalog registry", () => {
  it("accepts immutable, owner-scoped licensed catalogs", () => {
    equipmentCatalogRegistry.register("example-genre", {
      id: "example-genre.equipment",
      label: "Example equipment",
      version: 1,
      entries: [
        {
          era: "modern",
          id: "field-kit",
          kind: "gear",
          name: "Field Kit",
          source: { book: "Example Open Content", page: 12 },
          system: { mass: 2 },
        },
      ],
    });
    const catalog = equipmentCatalogRegistry.current()[0];
    expect(catalog).toMatchObject({
      id: "example-genre.equipment",
      ownerId: "example-genre",
      version: 1,
    });
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog?.entries[0]?.system)).toBe(true);
  });

  it("rejects invalid entries and cross-owner ID conflicts", () => {
    expect(() =>
      equipmentCatalogRegistry.register("bad owner", {
        entries: [],
        id: "bad.catalog",
        label: "Bad",
        version: 1,
      }),
    ).toThrow("stable lowercase ID");
    equipmentCatalogRegistry.register("owner-one", {
      entries: [],
      id: "shared.catalog",
      label: "One",
      version: 1,
    });
    expect(() =>
      equipmentCatalogRegistry.register("owner-two", {
        entries: [],
        id: "shared.catalog",
        label: "Two",
        version: 1,
      }),
    ).toThrow("already owned by owner-one");
  });

  it("unregisters every catalog owned by a disabled package", () => {
    equipmentCatalogRegistry.register("owner-one", {
      entries: [],
      id: "owner-one.a",
      label: "A",
      version: 1,
    });
    equipmentCatalogRegistry.register("owner-one", {
      entries: [],
      id: "owner-one.b",
      label: "B",
      version: 1,
    });
    equipmentCatalogRegistry.unregisterOwner("owner-one");
    expect(equipmentCatalogRegistry.current()).toEqual([]);
  });
});
