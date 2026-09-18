import type {
  D6StorageCapacityResultV1,
  D6StorageGridV1,
  D6StorageLedgerV1,
  D6StorageLocationV1,
  D6StorageMoveIssue,
  D6StorageMoveRequestV1,
  D6StorageObjectV1,
  D6StorageParentV1,
  D6StoragePhysicalProfileV1,
  D6StorageRectangleV1,
  D6StorageRotation,
  D6StorageSpaceV1,
} from "../contracts/grid-storage.js";

export interface D6StorageFootprint {
  readonly columns: number;
  readonly rows: number;
}

export interface D6StorageValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export interface D6StorageMoveEvaluation {
  readonly allowed: boolean;
  readonly issue?: D6StorageMoveIssue;
  readonly capacity: D6StorageCapacityResultV1;
  readonly resultingLedger?: D6StorageLedgerV1;
}

export interface D6StoragePackResult {
  readonly outcome: "packed" | "proven-impossible" | "not-found-within-limit";
  readonly visitedNodes: number;
  readonly placements: Readonly<Record<string, D6StorageRectangleV1>>;
  readonly eligibleInstanceIds: readonly string[];
  readonly excludedInstanceIds: readonly string[];
}

export interface D6StorageAvailability {
  readonly configured: boolean;
  readonly reachable: boolean;
  readonly canUse: boolean;
  readonly canEquip: boolean;
  readonly effectiveEquipped: boolean;
  readonly effectiveInstalled: boolean;
}

type MutableStorageCapacityResult = {
  -readonly [
    Key in keyof D6StorageCapacityResultV1
  ]: D6StorageCapacityResultV1[Key];
};

const availableCapacity = (): MutableStorageCapacityResult => ({
  height: "available",
  grid: "available",
  weight: "available",
  volume: "available",
  count: "available",
});

const isPositiveInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

const isNonNegativeIntegerOrNull = (value: number | null): boolean =>
  value === null || (Number.isSafeInteger(value) && value >= 0);

export function storageFootprint(
  physical: D6StoragePhysicalProfileV1,
  grid: D6StorageGridV1,
  rotation: D6StorageRotation = "none",
): D6StorageFootprint | null {
  const authored = physical.footprintsByScale[grid.scaleId];
  let columns: number;
  let rows: number;
  if (authored) {
    columns = authored.columns;
    rows = authored.rows;
  } else {
    if (
      !isPositiveInteger(physical.widthMm ?? 0) ||
      !isPositiveInteger(physical.depthMm ?? 0) ||
      !isPositiveInteger(grid.cellWidthMm) ||
      !isPositiveInteger(grid.cellDepthMm)
    )
      return null;
    columns = Math.ceil((physical.widthMm ?? 0) / grid.cellWidthMm);
    rows = Math.ceil((physical.depthMm ?? 0) / grid.cellDepthMm);
  }
  if (!isPositiveInteger(columns) || !isPositiveInteger(rows)) return null;
  if (rotation === "quarter-turn") {
    if (!physical.rotatable) return null;
    return { columns: rows, rows: columns };
  }
  return { columns, rows };
}

export function storageSpace(
  ledger: D6StorageLedgerV1,
  parent: D6StorageParentV1,
): D6StorageSpaceV1 | undefined {
  const root = ledger.roots[parent.rootUuid];
  if (!root) return undefined;
  if (!parent.containerInstanceId) {
    const space = root.spaces[parent.spaceId];
    return space?.ownerActorUuid === parent.spaceOwnerActorUuid
      ? space
      : undefined;
  }
  const container = ledger.objects[parent.containerInstanceId];
  const interior = container?.definition.interior;
  return container &&
    interior?.id === parent.spaceId &&
    interior.ownerActorUuid === parent.spaceOwnerActorUuid &&
    locationRoot(container.location) === parent.rootUuid
    ? interior
    : undefined;
}

function locationRoot(location: D6StorageLocationV1): string {
  return location.state === "unplaced"
    ? location.rootUuid
    : location.parent.rootUuid;
}

function sameParent(
  location: D6StorageLocationV1,
  parent: D6StorageParentV1,
): boolean {
  return (
    location.state !== "unplaced" &&
    location.parent.rootUuid === parent.rootUuid &&
    location.parent.spaceId === parent.spaceId &&
    location.parent.containerInstanceId === parent.containerInstanceId &&
    location.parent.spaceOwnerActorUuid === parent.spaceOwnerActorUuid
  );
}

function isStorageParent(value: unknown): value is D6StorageParentV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const parent = value as Record<string, unknown>;
  return (
    typeof parent.rootUuid === "string" &&
    parent.rootUuid.length > 0 &&
    typeof parent.spaceId === "string" &&
    parent.spaceId.length > 0 &&
    (parent.containerInstanceId === null ||
      (typeof parent.containerInstanceId === "string" &&
        parent.containerInstanceId.length > 0)) &&
    typeof parent.spaceOwnerActorUuid === "string" &&
    parent.spaceOwnerActorUuid.length > 0
  );
}

function directChildren(
  ledger: D6StorageLedgerV1,
  parent: D6StorageParentV1,
): D6StorageObjectV1[] {
  return Object.values(ledger.objects).filter((object) =>
    sameParent(object.location, parent),
  );
}

function parentContainer(
  ledger: D6StorageLedgerV1,
  object: D6StorageObjectV1,
): D6StorageObjectV1 | undefined {
  return object.location.state === "unplaced" ||
    !object.location.parent.containerInstanceId
    ? undefined
    : ledger.objects[object.location.parent.containerInstanceId];
}

function subtreeIds(ledger: D6StorageLedgerV1, instanceId: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    result.push(id);
    for (const object of Object.values(ledger.objects))
      if (
        object.location.state !== "unplaced" &&
        object.location.parent.containerInstanceId === id
      )
        visit(object.definition.instanceId);
  };
  visit(instanceId);
  return result;
}

export function storageAggregateMassGrams(
  ledger: D6StorageLedgerV1,
  instanceId: string,
): number | null {
  const visiting = new Set<string>();
  const calculate = (id: string): number | null => {
    if (visiting.has(id)) return null;
    const object = ledger.objects[id];
    if (!object) return null;
    const tare = object.definition.physical.unitTareWeightGrams;
    if (tare === null) return null;
    visiting.add(id);
    let total = tare * object.quantity;
    for (const child of Object.values(ledger.objects)) {
      if (
        child.location.state === "unplaced" ||
        child.location.parent.containerInstanceId !== id
      )
        continue;
      const childMass = calculate(child.definition.instanceId);
      if (childMass === null) {
        visiting.delete(id);
        return null;
      }
      total += childMass;
    }
    visiting.delete(id);
    return Number.isSafeInteger(total) ? total : null;
  };
  return calculate(instanceId);
}

export function storageOccupiedVolumeMillilitres(
  ledger: D6StorageLedgerV1,
  parent: D6StorageParentV1,
): number | null {
  let total = 0;
  for (const object of directChildren(ledger, parent)) {
    const volume = object.definition.physical.unitExteriorVolumeMillilitres;
    if (volume === null) return null;
    total += volume * object.quantity;
  }
  return Number.isSafeInteger(total) ? total : null;
}

function rectanglesOverlap(
  left: D6StorageRectangleV1,
  right: D6StorageRectangleV1,
): boolean {
  return (
    left.x < right.x + right.columns &&
    left.x + left.columns > right.x &&
    left.y < right.y + right.rows &&
    left.y + left.rows > right.y
  );
}

function rectangleInside(
  rectangle: D6StorageRectangleV1,
  grid: D6StorageGridV1,
): boolean {
  return (
    Number.isSafeInteger(rectangle.x) &&
    Number.isSafeInteger(rectangle.y) &&
    rectangle.x >= 0 &&
    rectangle.y >= 0 &&
    isPositiveInteger(rectangle.columns) &&
    isPositiveInteger(rectangle.rows) &&
    rectangle.x + rectangle.columns <= grid.columns &&
    rectangle.y + rectangle.rows <= grid.rows
  );
}

export function evaluateStorageSpace(
  ledger: D6StorageLedgerV1,
  parent: D6StorageParentV1,
): D6StorageCapacityResultV1 {
  const result = availableCapacity();
  const space = storageSpace(ledger, parent);
  if (!space || space.configuration === "unconfigured")
    return { ...result, grid: "not-configured" };
  const children = directChildren(ledger, parent);
  if (space.configuration === "capacity-only") {
    result.grid = "not-configured";
    if (children.some((object) => object.location.state !== "listed"))
      result.grid = "outside";
  } else {
    const grid = space.grid;
    if (!grid) result.grid = "not-configured";
    else {
      const placed = children.filter(
        (
          object,
        ): object is D6StorageObjectV1 & {
          location: Extract<D6StorageLocationV1, { state: "placed" }>;
        } => object.location.state === "placed",
      );
      if (placed.length !== children.length) result.grid = "outside";
      for (let index = 0; index < placed.length; index += 1) {
        const object = placed[index];
        if (!object) continue;
        const footprint = storageFootprint(
          object.definition.physical,
          grid,
          object.location.rectangle.rotation,
        );
        if (!footprint) {
          result.grid = "unknown-footprint";
          break;
        }
        const rectangle = object.location.rectangle;
        if (
          rectangle.columns !== footprint.columns ||
          rectangle.rows !== footprint.rows ||
          !rectangleInside(rectangle, grid)
        ) {
          result.grid = "outside";
          break;
        }
        if (
          placed
            .slice(index + 1)
            .some((other) =>
              rectanglesOverlap(rectangle, other.location.rectangle),
            )
        ) {
          result.grid = "overlap";
          break;
        }
      }
    }
  }
  const interiorHeightMm = space.interiorHeightMm;
  if (interiorHeightMm != null) {
    const heights = children.map(
      (object) => object.definition.physical.heightMm,
    );
    result.height = heights.some(
      (height) =>
        height === null || !Number.isSafeInteger(height) || height < 0,
    )
      ? "unknown-measurement"
      : heights.some((height) => (height ?? 0) > interiorHeightMm)
        ? "exceeded"
        : "available";
  }
  const limits = space.limits;
  if (limits.maxDirectChildren !== null)
    result.count =
      children.length <= limits.maxDirectChildren ? "available" : "exceeded";
  if (limits.maxAggregateWeightGrams !== null) {
    const masses = children.map((object) =>
      storageAggregateMassGrams(ledger, object.definition.instanceId),
    );
    result.weight = masses.some((mass) => mass === null)
      ? "unknown-measurement"
      : masses.reduce<number>((sum, mass) => sum + (mass ?? 0), 0) <=
          limits.maxAggregateWeightGrams
        ? "available"
        : "exceeded";
  }
  if (limits.maxOccupiedVolumeMillilitres !== null) {
    const volume = storageOccupiedVolumeMillilitres(ledger, parent);
    result.volume =
      volume === null
        ? "unknown-measurement"
        : volume <= limits.maxOccupiedVolumeMillilitres
          ? "available"
          : "exceeded";
  }
  return result;
}

function capacityIssue(
  capacity: D6StorageCapacityResultV1,
): D6StorageMoveIssue | undefined {
  if (capacity.grid === "unknown-footprint") return "unknown-footprint";
  if (
    capacity.height === "unknown-measurement" ||
    capacity.weight === "unknown-measurement" ||
    capacity.volume === "unknown-measurement"
  )
    return "unknown-measurement";
  if (
    ["overlap", "outside"].includes(capacity.grid) ||
    capacity.height === "exceeded" ||
    capacity.weight === "exceeded" ||
    capacity.volume === "exceeded" ||
    capacity.count === "exceeded"
  )
    return "capacity";
  return undefined;
}

function withCanonicalRoot(
  object: D6StorageObjectV1,
  rootUuid: string,
): D6StorageObjectV1 {
  if (object.location.state === "unplaced")
    return { ...object, location: { ...object.location, rootUuid } };
  return {
    ...object,
    location: {
      ...object.location,
      parent: { ...object.location.parent, rootUuid },
    },
  };
}

export function evaluateStorageMove(
  ledger: D6StorageLedgerV1,
  request: D6StorageMoveRequestV1,
  reservedSplitInstanceId = "__storage_split_preview__",
): D6StorageMoveEvaluation {
  const baseline = availableCapacity();
  if (typeof request.pinned !== "boolean")
    return { allowed: false, issue: "invalid", capacity: baseline };
  const destinationValue: unknown = request.destination;
  if (destinationValue !== null && !isStorageParent(destinationValue))
    return { allowed: false, issue: "invalid", capacity: baseline };
  if (request.baseRevision !== ledger.revision)
    return { allowed: false, issue: "stale", capacity: baseline };
  const object = ledger.objects[request.instanceId];
  const destination =
    request.destination === null
      ? undefined
      : storageSpace(ledger, request.destination);
  if (!object || (request.destination !== null && !destination))
    return { allowed: false, issue: "deleted", capacity: baseline };
  if (
    Object.entries(request.witnesses).some(
      ([id, witness]) => ledger.objects[id]?.witness !== witness,
    )
  )
    return { allowed: false, issue: "stale", capacity: baseline };
  const moveQuantity =
    request.quantity === "all" ? object.quantity : request.quantity;
  if (
    !isPositiveInteger(moveQuantity) ||
    moveQuantity > object.quantity ||
    !isPositiveInteger(object.quantity)
  )
    return { allowed: false, issue: "unsupported-stack", capacity: baseline };
  if (
    object.definition.interior &&
    (object.quantity !== 1 || moveQuantity !== object.quantity)
  )
    return { allowed: false, issue: "unsupported-stack", capacity: baseline };
  if (
    request.ownershipTransfer.mode === "transfer" &&
    (!request.ownershipTransfer.targetOwnerActorUuid ||
      (object.definition.interior &&
        request.ownershipTransfer.scope === "object-only"))
  )
    return { allowed: false, issue: "invalid", capacity: baseline };
  if (
    request.ownershipTransfer.mode === "preserve" &&
    request.ownershipTransfer.targetOwnerActorUuid !== null
  )
    return { allowed: false, issue: "invalid", capacity: baseline };
  const targetOwnerActorUuid =
    request.ownershipTransfer.mode === "transfer" &&
    request.ownershipTransfer.targetOwnerActorUuid
      ? request.ownershipTransfer.targetOwnerActorUuid
      : object.ownerActorUuid;
  if (request.destination === null) {
    if (
      object.location.state !== "unplaced" ||
      object.location.disposition === "installed" ||
      moveQuantity !== object.quantity ||
      request.rectangle !== null ||
      request.pinned ||
      request.ownershipTransfer.mode !== "preserve" ||
      request.ownershipTransfer.scope !== "object-only" ||
      !["carried", "equipped"].includes(request.disposition)
    )
      return { allowed: false, issue: "invalid", capacity: baseline };
    return {
      allowed: true,
      capacity: baseline,
      resultingLedger: {
        ...ledger,
        revision: ledger.revision + 1,
        objects: {
          ...ledger.objects,
          [request.instanceId]: {
            ...object,
            location: { ...object.location, disposition: request.disposition },
          },
        },
      },
    };
  }
  if (moveQuantity > object.definition.physical.stack.maxQuantityPerPlacement)
    return { allowed: false, issue: "unsupported-stack", capacity: baseline };
  if (!destination)
    return { allowed: false, issue: "deleted", capacity: baseline };
  if (
    request.destination.containerInstanceId &&
    subtreeIds(ledger, object.definition.instanceId).includes(
      request.destination.containerInstanceId,
    )
  )
    return { allowed: false, issue: "cycle", capacity: baseline };
  if (
    destination.configuration === "grid"
      ? !request.rectangle
      : request.rectangle
  )
    return { allowed: false, issue: "invalid", capacity: baseline };
  const movedLocation: D6StorageLocationV1 = request.rectangle
    ? {
        state: "placed",
        parent: request.destination,
        rectangle: request.rectangle,
        disposition: request.disposition,
        pinned: request.pinned,
      }
    : {
        state: "listed",
        parent: request.destination,
        disposition: request.disposition,
        pinned: request.pinned,
      };
  const objects: Record<string, D6StorageObjectV1> = { ...ledger.objects };
  if (moveQuantity === object.quantity) {
    objects[request.instanceId] = { ...object, location: movedLocation };
    if (locationRoot(object.location) !== request.destination.rootUuid)
      for (const id of subtreeIds(ledger, request.instanceId)) {
        const current = objects[id];
        if (current)
          objects[id] = withCanonicalRoot(
            current,
            request.destination.rootUuid,
          );
      }
    objects[request.instanceId] = {
      ...(objects[request.instanceId] ?? object),
      location: movedLocation,
    };
    if (request.ownershipTransfer.mode === "transfer") {
      const ids =
        request.ownershipTransfer.scope === "subtree"
          ? subtreeIds(ledger, request.instanceId)
          : [request.instanceId];
      for (const id of ids) {
        const current = objects[id];
        if (current)
          objects[id] = {
            ...current,
            ownerActorUuid: targetOwnerActorUuid,
          };
      }
    }
  } else {
    if (objects[reservedSplitInstanceId])
      return { allowed: false, issue: "invalid", capacity: baseline };
    objects[request.instanceId] = {
      ...object,
      quantity: object.quantity - moveQuantity,
    };
    objects[reservedSplitInstanceId] = {
      ...object,
      definition: { ...object.definition, instanceId: reservedSplitInstanceId },
      documentUuid: reservedSplitInstanceId,
      ownerActorUuid:
        request.ownershipTransfer.mode === "transfer"
          ? targetOwnerActorUuid
          : object.ownerActorUuid,
      quantity: moveQuantity,
      witness: "preview",
      location: movedLocation,
    };
  }
  const next: D6StorageLedgerV1 = {
    ...ledger,
    revision: ledger.revision + 1,
    objects,
  };
  const capacity = evaluateStorageSpace(next, request.destination);
  const issue = capacityIssue(capacity);
  if (issue) return { allowed: false, issue, capacity };
  return { allowed: true, capacity, resultingLedger: next };
}

export function validateStorageLedger(
  ledger: D6StorageLedgerV1,
): D6StorageValidationResult {
  const issues: string[] = [];
  if (!Number.isSafeInteger(ledger.revision) || ledger.revision < 0)
    issues.push("ledger-revision");
  for (const root of Object.values(ledger.roots)) {
    if (root.rootUuid === "" || root.revision < 0) issues.push("root-identity");
    for (const space of Object.values(root.spaces)) {
      if (
        space.interiorHeightMm != null &&
        !isPositiveInteger(space.interiorHeightMm)
      )
        issues.push(`space-height:${root.rootUuid}:${space.id}`);
      const hasGrid = Boolean(space.grid);
      if ((space.configuration === "grid") !== hasGrid)
        issues.push(`space-configuration:${root.rootUuid}:${space.id}`);
      if (
        space.grid &&
        (!isPositiveInteger(space.grid.columns) ||
          !isPositiveInteger(space.grid.rows) ||
          !isPositiveInteger(space.grid.cellWidthMm) ||
          !isPositiveInteger(space.grid.cellDepthMm))
      )
        issues.push(`space-grid:${root.rootUuid}:${space.id}`);
    }
  }
  for (const object of Object.values(ledger.objects)) {
    const id = object.definition.instanceId;
    const physical = object.definition.physical;
    if (!id || ledger.objects[id] !== object)
      issues.push(`object-identity:${id}`);
    if (
      !isPositiveInteger(object.quantity) ||
      !isPositiveInteger(physical.stack.maxQuantityPerPlacement) ||
      (object.location.state !== "unplaced" &&
        object.quantity > physical.stack.maxQuantityPerPlacement) ||
      (physical.stack.mode === "single" &&
        physical.stack.maxQuantityPerPlacement !== 1)
    )
      issues.push(`object-stack:${id}`);
    if (
      !isNonNegativeIntegerOrNull(physical.unitTareWeightGrams) ||
      !isNonNegativeIntegerOrNull(physical.unitExteriorVolumeMillilitres)
    )
      issues.push(`object-measurement:${id}`);
    if (
      object.definition.interior?.interiorHeightMm != null &&
      !isPositiveInteger(object.definition.interior.interiorHeightMm)
    )
      issues.push(`space-height:${id}`);
    if (object.definition.interior && object.quantity !== 1)
      issues.push(`container-quantity:${id}`);
    if (!ledger.roots[locationRoot(object.location)])
      issues.push(`object-root:${id}`);
    if (object.location.state !== "unplaced") {
      if (!storageSpace(ledger, object.location.parent))
        issues.push(`object-parent:${id}`);
      const parent = parentContainer(ledger, object);
      if (object.location.parent.containerInstanceId && !parent)
        issues.push(`object-container:${id}`);
    }
    const ancestors = new Set<string>([id]);
    let current = parentContainer(ledger, object);
    while (current) {
      const parentId = current.definition.instanceId;
      if (ancestors.has(parentId)) {
        issues.push(`object-cycle:${id}`);
        break;
      }
      ancestors.add(parentId);
      current = parentContainer(ledger, current);
    }
  }
  const checkedSpaces = new Set<string>();
  for (const object of Object.values(ledger.objects)) {
    if (object.location.state === "unplaced") continue;
    const parent = object.location.parent;
    const key = `${parent.rootUuid}:${parent.containerInstanceId ?? ""}:${parent.spaceId}`;
    if (checkedSpaces.has(key)) continue;
    checkedSpaces.add(key);
    if (capacityIssue(evaluateStorageSpace(ledger, parent)))
      issues.push(`space-capacity:${key}`);
  }
  return { valid: issues.length === 0, issues };
}

interface CandidatePlacement {
  instanceId: string;
  orientations: readonly [D6StorageFootprint, ...D6StorageFootprint[]];
}

export function packStorageSpace(
  ledger: D6StorageLedgerV1,
  parent: D6StorageParentV1,
  requestedInstanceIds: readonly string[],
  maxSearchNodes: number,
): D6StoragePackResult {
  const space = storageSpace(ledger, parent);
  const grid = space?.configuration === "grid" ? space.grid : null;
  if (!grid || !isPositiveInteger(maxSearchNodes))
    return {
      outcome: "proven-impossible",
      visitedNodes: 0,
      placements: {},
      eligibleInstanceIds: [],
      excludedInstanceIds: [...requestedInstanceIds].sort(),
    };
  const requested = [...new Set(requestedInstanceIds)].sort();
  const excluded: string[] = [];
  const fixed: Record<string, D6StorageRectangleV1> = {};
  const candidates: CandidatePlacement[] = [];
  for (const id of requested) {
    const object = ledger.objects[id];
    if (!object || locationRoot(object.location) !== parent.rootUuid) {
      excluded.push(id);
      continue;
    }
    const base = storageFootprint(object.definition.physical, grid, "none");
    if (
      !base ||
      (space?.interiorHeightMm != null &&
        (object.definition.physical.heightMm === null ||
          !Number.isSafeInteger(object.definition.physical.heightMm) ||
          object.definition.physical.heightMm < 0 ||
          object.definition.physical.heightMm > space.interiorHeightMm))
    ) {
      excluded.push(id);
      continue;
    }
    if (
      object.location.state === "placed" &&
      sameParent(object.location, parent) &&
      object.location.pinned
    ) {
      fixed[id] = object.location.rectangle;
      continue;
    }
    const rotated = storageFootprint(
      object.definition.physical,
      grid,
      "quarter-turn",
    );
    const orientations: [D6StorageFootprint, ...D6StorageFootprint[]] = [base];
    if (
      rotated &&
      (rotated.columns !== base.columns || rotated.rows !== base.rows)
    )
      orientations.push(rotated);
    candidates.push({ instanceId: id, orientations });
  }
  candidates.sort((left, right) => {
    const a = left.orientations[0];
    const b = right.orientations[0];
    return (
      Math.max(b.columns, b.rows) - Math.max(a.columns, a.rows) ||
      b.columns * b.rows - a.columns * a.rows ||
      Math.min(b.columns, b.rows) - Math.min(a.columns, a.rows) ||
      left.instanceId.localeCompare(right.instanceId)
    );
  });
  const placements: Record<string, D6StorageRectangleV1> = { ...fixed };
  if (
    Object.values(fixed).some(
      (rectangle, index, all) =>
        !rectangleInside(rectangle, grid) ||
        all
          .slice(index + 1)
          .some((other) => rectanglesOverlap(rectangle, other)),
    )
  )
    return {
      outcome: "proven-impossible",
      visitedNodes: 0,
      placements: {},
      eligibleInstanceIds: requested.filter((id) => !excluded.includes(id)),
      excludedInstanceIds: excluded,
    };
  let visitedNodes = 0;
  const search = (index: number): D6StoragePackResult["outcome"] => {
    if (index === candidates.length) return "packed";
    const candidate = candidates[index];
    if (!candidate) return "packed";
    for (const [orientation, footprint] of candidate.orientations.entries()) {
      for (let y = 0; y <= grid.rows - footprint.rows; y += 1) {
        for (let x = 0; x <= grid.columns - footprint.columns; x += 1) {
          visitedNodes += 1;
          if (visitedNodes > maxSearchNodes) return "not-found-within-limit";
          const rectangle: D6StorageRectangleV1 = {
            x,
            y,
            columns: footprint.columns,
            rows: footprint.rows,
            rotation: orientation === 0 ? "none" : "quarter-turn",
          };
          if (
            Object.values(placements).some((placed) =>
              rectanglesOverlap(rectangle, placed),
            )
          )
            continue;
          placements[candidate.instanceId] = rectangle;
          const outcome = search(index + 1);
          if (outcome === "packed") return outcome;
          Reflect.deleteProperty(placements, candidate.instanceId);
          if (outcome === "not-found-within-limit") return outcome;
        }
      }
    }
    return "proven-impossible";
  };
  const outcome = search(0);
  return {
    outcome,
    visitedNodes: Math.min(visitedNodes, maxSearchNodes),
    placements: outcome === "packed" ? placements : {},
    eligibleInstanceIds: requested.filter((id) => !excluded.includes(id)),
    excludedInstanceIds: excluded,
  };
}

export function effectiveStorageAvailability(
  ledger: D6StorageLedgerV1,
  instanceId: string,
  actingActorUuid: string,
): D6StorageAvailability {
  const object = ledger.objects[instanceId];
  if (!object)
    return {
      configured: false,
      reachable: true,
      canUse: true,
      canEquip: true,
      effectiveEquipped: false,
      effectiveInstalled: false,
    };
  if (object.location.state === "unplaced") {
    const reachable = object.location.rootUuid === actingActorUuid;
    const installed = object.location.disposition === "installed";
    return {
      configured: true,
      reachable,
      canUse: reachable && !installed,
      canEquip: reachable && !installed,
      effectiveEquipped:
        reachable && object.location.disposition === "equipped",
      effectiveInstalled: reachable && installed,
    };
  }
  let reachable = locationRoot(object.location) === actingActorUuid;
  let current: D6StorageObjectV1 | undefined = object;
  while (reachable && current) {
    if (current.location.state !== "unplaced") {
      const space = storageSpace(ledger, current.location.parent);
      if (space?.access !== "open") reachable = false;
    }
    current = parentContainer(ledger, current);
  }
  const disposition = object.location.disposition;
  return {
    configured: true,
    reachable,
    canUse: reachable && disposition !== "installed",
    canEquip: reachable && disposition !== "installed",
    effectiveEquipped: reachable && disposition === "equipped",
    effectiveInstalled: reachable && disposition === "installed",
  };
}
