import { describe, expect, it } from "vitest";

import type {
  D6StorageGridV1,
  D6StorageLedgerV1,
  D6StorageMoveRequestV1,
  D6StorageObjectV1,
  D6StorageParentV1,
  D6StoragePhysicalProfileV1,
  D6StorageSpaceV1,
} from "../contracts/grid-storage.js";
import {
  effectiveStorageAvailability,
  evaluateStorageMove,
  evaluateStorageSpace,
  packStorageSpace,
  storageAggregateMassGrams,
  storageFootprint,
  storageOccupiedVolumeMillilitres,
  validateStorageLedger,
} from "./grid-storage.js";

const rootUuid = "Actor.root";
const ownerActorUuid = rootUuid;

const grid = (columns = 4, rows = 3): D6StorageGridV1 => ({
  version: 1,
  scaleId: "personal-100",
  scaleLabel: "Personal · 100 mm squares",
  columns,
  rows,
  cellWidthMm: 100,
  cellDepthMm: 100,
});

const limits = {
  maxAggregateWeightGrams: null,
  maxOccupiedVolumeMillilitres: null,
  maxDirectChildren: null,
} as const;

const space = (
  id = "cargo",
  value: Partial<D6StorageSpaceV1> = {},
): D6StorageSpaceV1 => ({
  id,
  label: id,
  kind: "cargo",
  ownerActorUuid,
  configuration: "grid",
  access: "open",
  grid: grid(),
  limits,
  ...value,
});

const physical = (
  columns: number | null,
  rows: number | null,
  value: Partial<D6StoragePhysicalProfileV1> = {},
): D6StoragePhysicalProfileV1 => ({
  version: 1,
  provenance: columns && rows ? "preset" : "unknown",
  presetId: columns && rows ? "test" : null,
  widthMm: null,
  depthMm: null,
  heightMm: null,
  unitTareWeightGrams: 0,
  unitExteriorVolumeMillilitres: 0,
  rotatable: true,
  footprintsByScale:
    columns && rows
      ? {
          "personal-100": { columns, rows, provenance: "preset" },
        }
      : {},
  stack: { mode: "single", maxQuantityPerPlacement: 1 },
  ...value,
});

const parent = (value: Partial<D6StorageParentV1> = {}): D6StorageParentV1 => ({
  rootUuid,
  spaceId: "cargo",
  containerInstanceId: null,
  spaceOwnerActorUuid: ownerActorUuid,
  ...value,
});

const object = (
  instanceId: string,
  columns: number | null,
  rows: number | null,
  value: Partial<D6StorageObjectV1> = {},
): D6StorageObjectV1 => ({
  version: 1,
  definition: { version: 1, instanceId, physical: physical(columns, rows) },
  documentUuid: `${ownerActorUuid}.Item.${instanceId}`,
  ownerActorUuid,
  quantity: 1,
  witness: `${instanceId}-witness`,
  location: { state: "unplaced", rootUuid, disposition: "stored" },
  ...value,
});

const ledger = (
  objects: readonly D6StorageObjectV1[],
  spaces: readonly D6StorageSpaceV1[] = [space()],
): D6StorageLedgerV1 => ({
  version: 1,
  revision: 7,
  roots: {
    [rootUuid]: {
      version: 1,
      rootUuid,
      kind: "character",
      revision: 7,
      spaces: Object.fromEntries(spaces.map((value) => [value.id, value])),
      publicSummary: "none",
    },
  },
  objects: Object.fromEntries(
    objects.map((value) => [value.definition.instanceId, value]),
  ),
});

describe("grid storage domain", () => {
  it("uses explicit scale footprints and requires proof for another scale", () => {
    const profile = physical(2, 3);

    expect(storageFootprint(profile, grid(), "none")).toEqual({
      columns: 2,
      rows: 3,
    });
    expect(storageFootprint(profile, grid(), "quarter-turn")).toEqual({
      columns: 3,
      rows: 2,
    });
    expect(
      storageFootprint(profile, { ...grid(), scaleId: "cargo-500" }),
    ).toBeNull();
    expect(
      storageFootprint(
        { ...profile, widthMm: 210, depthMm: 101 },
        { ...grid(), scaleId: "custom" },
      ),
    ).toEqual({ columns: 3, rows: 2 });
  });

  it("counts nested mass recursively but exterior volume only at each boundary", () => {
    const interior = space("interior", {
      kind: "container",
      maxDirectChildren: undefined,
      grid: grid(3, 2),
    } as never);
    const crate = object("crate", 2, 2, {
      definition: {
        version: 1,
        instanceId: "crate",
        physical: physical(2, 2, {
          unitTareWeightGrams: 2_000,
          unitExteriorVolumeMillilitres: 20_000,
        }),
        interior,
      },
      location: {
        state: "placed",
        parent: parent(),
        rectangle: { x: 0, y: 0, columns: 2, rows: 2, rotation: "none" },
        disposition: "stored",
        pinned: false,
      },
    });
    const interiorParent = parent({
      spaceId: "interior",
      containerInstanceId: "crate",
    });
    const tool = (id: string, x: number) =>
      object(id, 1, 1, {
        definition: {
          version: 1,
          instanceId: id,
          physical: physical(1, 1, {
            unitTareWeightGrams: 1_000,
            unitExteriorVolumeMillilitres: 3_000,
          }),
        },
        location: {
          state: "placed",
          parent: interiorParent,
          rectangle: { x, y: 0, columns: 1, rows: 1, rotation: "none" },
          disposition: "stored",
          pinned: false,
        },
      });
    const state = ledger([crate, tool("tool-a", 0), tool("tool-b", 1)]);

    expect(storageAggregateMassGrams(state, "crate")).toBe(4_000);
    expect(storageOccupiedVolumeMillilitres(state, parent())).toBe(20_000);
    expect(storageOccupiedVolumeMillilitres(state, interiorParent)).toBe(6_000);
  });

  it("blocks overlap, unknown enabled measurements, and over-limit stacks", () => {
    const constrained = space("cargo", {
      limits: {
        maxAggregateWeightGrams: 1_000,
        maxOccupiedVolumeMillilitres: null,
        maxDirectChildren: 2,
      },
    });
    const first = object("first", 2, 2, {
      location: {
        state: "placed",
        parent: parent(),
        rectangle: { x: 0, y: 0, columns: 2, rows: 2, rotation: "none" },
        disposition: "stored",
        pinned: false,
      },
      definition: {
        version: 1,
        instanceId: "first",
        physical: physical(2, 2, { unitTareWeightGrams: null }),
      },
    });
    const second = object("second", 2, 1, {
      location: {
        state: "placed",
        parent: parent(),
        rectangle: { x: 1, y: 1, columns: 2, rows: 1, rotation: "none" },
        disposition: "stored",
        pinned: false,
      },
    });
    const invalidStack = object("stack", 1, 1, {
      quantity: 7,
      location: {
        state: "listed",
        parent: parent(),
        disposition: "stored",
        pinned: false,
      },
      definition: {
        version: 1,
        instanceId: "stack",
        physical: physical(1, 1, {
          stack: { mode: "bounded", maxQuantityPerPlacement: 6 },
        }),
      },
    });
    const state = ledger([first, second, invalidStack], [constrained]);

    expect(evaluateStorageSpace(state, parent())).toMatchObject({
      grid: "overlap",
      weight: "unknown-measurement",
    });
    expect(validateStorageLedger(state).issues).toContain("object-stack:stack");

    const legacyUnplaced = {
      ...invalidStack,
      location: {
        state: "unplaced" as const,
        rootUuid,
        disposition: "carried" as const,
      },
    };
    expect(
      validateStorageLedger(ledger([legacyUnplaced])).issues,
    ).not.toContain("object-stack:stack");
  });

  it("previews an independent partial-stack placement without mutating source", () => {
    const stack = object("ration", 1, 1, {
      quantity: 3,
      definition: {
        version: 1,
        instanceId: "ration",
        physical: physical(1, 1, {
          unitTareWeightGrams: 100,
          unitExteriorVolumeMillilitres: 250,
          stack: { mode: "bounded", maxQuantityPerPlacement: 6 },
        }),
      },
      location: {
        state: "placed",
        parent: parent(),
        rectangle: { x: 0, y: 0, columns: 1, rows: 1, rotation: "none" },
        disposition: "stored",
        pinned: true,
      },
    });
    const state = ledger([stack]);
    const request: D6StorageMoveRequestV1 = {
      version: 1,
      operationId: "split-a",
      baseRevision: state.revision,
      instanceId: "ration",
      quantity: 1,
      destination: parent(),
      rectangle: { x: 1, y: 0, columns: 1, rows: 1, rotation: "none" },
      disposition: "stored",
      pinned: false,
      ownershipTransfer: {
        mode: "preserve",
        targetOwnerActorUuid: null,
        scope: "object-only",
      },
      witnesses: { ration: "ration-witness" },
    };

    const result = evaluateStorageMove(state, request, "ration-split");

    expect(result.allowed).toBe(true);
    expect(result.resultingLedger?.objects.ration?.quantity).toBe(2);
    expect(result.resultingLedger?.objects.ration?.location).toMatchObject({
      pinned: true,
    });
    expect(result.resultingLedger?.objects["ration-split"]?.quantity).toBe(1);
    expect(
      result.resultingLedger?.objects["ration-split"]?.location,
    ).toMatchObject({ pinned: false });
    expect(state.objects.ration?.quantity).toBe(3);
  });

  it("binds a desired pin state without treating pin as a movement lock", () => {
    const tool = object("tool", 1, 1, {
      location: {
        state: "placed",
        parent: parent(),
        rectangle: { x: 0, y: 0, columns: 1, rows: 1, rotation: "none" },
        disposition: "stored",
        pinned: true,
      },
    });
    const state = ledger([tool]);
    const request: D6StorageMoveRequestV1 = {
      version: 1,
      operationId: "pin-only",
      baseRevision: state.revision,
      instanceId: "tool",
      quantity: "all",
      destination: parent(),
      rectangle:
        tool.location.state === "placed" ? tool.location.rectangle : null,
      disposition: "stored",
      pinned: false,
      ownershipTransfer: {
        mode: "preserve",
        targetOwnerActorUuid: null,
        scope: "object-only",
      },
      witnesses: { tool: "tool-witness" },
    };

    const result = evaluateStorageMove(state, request);

    expect(result.resultingLedger?.objects.tool?.location).toMatchObject({
      state: "placed",
      pinned: false,
      rectangle: { x: 0, y: 0 },
    });
    expect(state.objects.tool?.location).toMatchObject({ pinned: true });
    expect(evaluateStorageMove(state, request)).toEqual(result);
    expect(
      evaluateStorageMove(state, {
        ...request,
        operationId: "missing-pin",
        pinned: undefined,
      } as unknown as D6StorageMoveRequestV1),
    ).toMatchObject({ allowed: false, issue: "invalid" });
    for (const malformedDestination of [undefined, false, 0, ""]) {
      expect(
        evaluateStorageMove(state, {
          ...request,
          operationId: `invalid-destination-${String(malformedDestination)}`,
          destination: malformedDestination,
        } as unknown as D6StorageMoveRequestV1),
      ).toMatchObject({ allowed: false, issue: "invalid" });
    }
  });

  it("changes an unplaced equipment disposition without inventing placement", () => {
    const state = ledger([object("tool", 1, 1)]);
    const request: D6StorageMoveRequestV1 = {
      version: 1,
      operationId: "equip-unplaced",
      baseRevision: state.revision,
      instanceId: "tool",
      quantity: "all",
      destination: null,
      rectangle: null,
      disposition: "equipped",
      pinned: false,
      ownershipTransfer: {
        mode: "preserve",
        targetOwnerActorUuid: null,
        scope: "object-only",
      },
      witnesses: { tool: "tool-witness" },
    };

    expect(
      evaluateStorageMove(state, request).resultingLedger?.objects.tool
        ?.location,
    ).toEqual({
      state: "unplaced",
      rootUuid,
      disposition: "equipped",
    });
    expect(
      evaluateStorageMove(state, {
        ...request,
        operationId: "invalid-unplaced",
        pinned: true,
      }),
    ).toMatchObject({ allowed: false, issue: "invalid" });
    expect(
      evaluateStorageMove(state, {
        ...request,
        operationId: "invalid-installed",
        disposition: "installed",
      }),
    ).toMatchObject({ allowed: false, issue: "invalid" });
    for (const invalid of [
      {
        operationId: "invalid-transfer",
        ownershipTransfer: {
          mode: "transfer" as const,
          targetOwnerActorUuid: "Actor.other",
          scope: "object-only" as const,
        },
      },
      {
        operationId: "invalid-rectangle",
        rectangle: {
          x: 0,
          y: 0,
          columns: 1,
          rows: 1,
          rotation: "none" as const,
        },
      },
      { operationId: "invalid-stored", disposition: "stored" as const },
    ])
      expect(
        evaluateStorageMove(state, { ...request, ...invalid }),
      ).toMatchObject({ allowed: false, issue: "invalid" });
    const splitState = ledger([
      object("tool", 1, 1, {
        quantity: 2,
        definition: {
          version: 1,
          instanceId: "tool",
          physical: physical(1, 1, {
            stack: { mode: "bounded", maxQuantityPerPlacement: 2 },
          }),
        },
      }),
    ]);
    expect(
      evaluateStorageMove(splitState, {
        ...request,
        operationId: "invalid-split",
        quantity: 1,
      }),
    ).toMatchObject({ allowed: false, issue: "invalid" });
    const legacyWholeStack = ledger([
      object("tool", 1, 1, {
        quantity: 3,
        definition: {
          version: 1,
          instanceId: "tool",
          physical: physical(1, 1),
        },
      }),
    ]);
    expect(
      evaluateStorageMove(legacyWholeStack, {
        ...request,
        operationId: "legacy-whole-stack-equip",
      }).resultingLedger?.objects.tool,
    ).toMatchObject({
      quantity: 3,
      location: { state: "unplaced", disposition: "equipped" },
    });
    const placed = ledger([
      object("tool", 1, 1, {
        location: {
          state: "placed",
          parent: parent(),
          rectangle: { x: 0, y: 0, columns: 1, rows: 1, rotation: "none" },
          disposition: "carried",
          pinned: false,
        },
      }),
    ]);
    expect(evaluateStorageMove(placed, request)).toMatchObject({
      allowed: false,
      issue: "invalid",
    });
  });

  it("changes only the moved container pin while preserving descendant pins", () => {
    const interiorParent = parent({
      spaceId: "interior",
      containerInstanceId: "case",
    });
    const caseObject = object("case", 2, 2, {
      definition: {
        version: 1,
        instanceId: "case",
        physical: physical(2, 2),
        interior: space("interior", { kind: "container", grid: grid(2, 2) }),
      },
      location: {
        state: "placed",
        parent: parent(),
        rectangle: { x: 0, y: 0, columns: 2, rows: 2, rotation: "none" },
        disposition: "carried",
        pinned: false,
      },
    });
    const child = object("child", 1, 1, {
      location: {
        state: "placed",
        parent: interiorParent,
        rectangle: { x: 0, y: 0, columns: 1, rows: 1, rotation: "none" },
        disposition: "stored",
        pinned: true,
      },
    });
    const interior = caseObject.definition.interior;
    if (!interior) throw new Error("missing fixture interior");
    const state = ledger([caseObject, child], [space(), interior]);
    const result = evaluateStorageMove(state, {
      version: 1,
      operationId: "pin-container",
      baseRevision: state.revision,
      instanceId: "case",
      quantity: "all",
      destination: parent(),
      rectangle:
        caseObject.location.state === "placed"
          ? caseObject.location.rectangle
          : null,
      disposition: "carried",
      pinned: true,
      ownershipTransfer: {
        mode: "preserve",
        targetOwnerActorUuid: null,
        scope: "object-only",
      },
      witnesses: { case: "case-witness" },
    });
    expect(result.resultingLedger?.objects.case?.location).toMatchObject({
      pinned: true,
    });
    expect(result.resultingLedger?.objects.child?.location).toMatchObject({
      pinned: true,
    });
  });

  it("packs the Supervisor fixture deterministically and excludes unknown items", () => {
    const kit = object("kit", 2, 2, {
      location: {
        state: "placed",
        parent: parent(),
        rectangle: { x: 0, y: 0, columns: 2, rows: 2, rotation: "none" },
        disposition: "stored",
        pinned: true,
      },
    });
    const state = ledger([
      kit,
      object("tool", 3, 1),
      object("torch", 1, 2),
      object("ration", 1, 1),
      object("unknown", null, null),
    ]);

    const packed = packStorageSpace(
      state,
      parent(),
      ["kit", "tool", "torch", "ration", "unknown"],
      10_000,
    );

    expect(packed.outcome).toBe("packed");
    expect(packed.excludedInstanceIds).toEqual(["unknown"]);
    expect(packed.placements).toMatchObject({
      kit: { x: 0, y: 0, columns: 2, rows: 2 },
      tool: { x: 0, y: 2, columns: 3, rows: 1 },
      torch: { x: 2, y: 0, columns: 1, rows: 2 },
      ration: { x: 3, y: 0, columns: 1, rows: 1 },
    });
  });

  it("distinguishes exhaustive impossibility from a search limit", () => {
    const state = ledger([object("large-a", 3, 3), object("large-b", 3, 3)]);

    expect(
      packStorageSpace(state, parent(), ["large-a", "large-b"], 10_000).outcome,
    ).toBe("proven-impossible");
    expect(
      packStorageSpace(state, parent(), ["large-a", "large-b"], 1).outcome,
    ).toBe("not-found-within-limit");
  });

  it("makes ancestor access and canonical root decisive for availability", () => {
    const closedInterior = space("interior", {
      kind: "container",
      access: "closed",
      grid: grid(2, 2),
    });
    const bag = object("bag", 2, 2, {
      definition: {
        version: 1,
        instanceId: "bag",
        physical: physical(2, 2),
        interior: closedInterior,
      },
      location: {
        state: "placed",
        parent: parent(),
        rectangle: { x: 0, y: 0, columns: 2, rows: 2, rotation: "none" },
        disposition: "carried",
        pinned: false,
      },
    });
    const medkit = object("medkit", 1, 1, {
      location: {
        state: "placed",
        parent: parent({
          spaceId: "interior",
          containerInstanceId: "bag",
        }),
        rectangle: { x: 0, y: 0, columns: 1, rows: 1, rotation: "none" },
        disposition: "stored",
        pinned: false,
      },
    });
    const state = ledger([bag, medkit]);

    expect(
      effectiveStorageAvailability(state, "medkit", ownerActorUuid),
    ).toMatchObject({ reachable: false, canUse: false });
    const openState: D6StorageLedgerV1 = {
      ...state,
      objects: {
        ...state.objects,
        bag: {
          ...bag,
          definition: {
            ...bag.definition,
            interior: { ...closedInterior, access: "open" },
          },
        },
      },
    };
    expect(
      effectiveStorageAvailability(openState, "medkit", ownerActorUuid),
    ).toMatchObject({ reachable: true, canUse: true, canEquip: true });
    expect(
      effectiveStorageAvailability(openState, "medkit", "Actor.other"),
    ).toMatchObject({ reachable: false, canUse: false });
  });

  it("keeps participating unplaced objects bound to their root and installed state", () => {
    const carried = ledger([object("tool", 1, 1)]);
    expect(
      effectiveStorageAvailability(carried, "tool", "Actor.other"),
    ).toMatchObject({
      configured: true,
      reachable: false,
      canUse: false,
      canEquip: false,
    });
    const carriedTool = carried.objects.tool;
    if (!carriedTool) throw new Error("missing carried tool fixture");
    const installed: D6StorageLedgerV1 = {
      ...carried,
      objects: {
        ...carried.objects,
        tool: {
          ...carriedTool,
          location: {
            state: "unplaced",
            rootUuid,
            disposition: "installed",
          },
        },
      },
    };
    expect(
      effectiveStorageAvailability(installed, "tool", ownerActorUuid),
    ).toMatchObject({
      configured: true,
      reachable: true,
      canUse: false,
      canEquip: false,
      effectiveInstalled: true,
    });
  });
});
