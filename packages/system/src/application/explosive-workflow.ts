import type {
  D6BlastProfile,
  D6ExplosiveRangeResolution,
  D6ExplosiveScatterPlan,
} from "@d6-system-2e/core";
import { normalizeD6BlastProfile } from "@d6-system-2e/core";

export const D6_EXPLOSIVE_REGION_STATE_SCHEMA = 1 as const;

export type D6ExplosiveWorkflowStatus =
  "aiming" | "armed" | "resolved" | "detonated" | "cancelled";

export interface D6CanvasPoint {
  readonly x: number;
  readonly y: number;
}

export interface D6ExplosiveAffectedTarget {
  readonly actorId: string;
  readonly label: string;
  readonly tokenId: string;
  readonly visible: boolean;
  readonly zone: 1 | 2 | 3 | 4;
}

export interface D6ExplosiveRegionStateV1 {
  readonly actorUuid: string;
  readonly affectedTargets: readonly D6ExplosiveAffectedTarget[];
  readonly aimedPoint: D6CanvasPoint;
  readonly attackHit?: boolean;
  readonly attackMessageId?: string;
  readonly blastProfile: D6BlastProfile;
  readonly combatId?: string;
  readonly difficulty: number;
  readonly itemUuid: string;
  readonly origin: D6CanvasPoint;
  readonly range: D6ExplosiveRangeResolution;
  readonly requestId: string;
  readonly resolvedPoint: D6CanvasPoint;
  readonly revision: number;
  readonly round?: number;
  readonly sceneId: string;
  readonly schema: typeof D6_EXPLOSIVE_REGION_STATE_SCHEMA;
  readonly scatter?: D6ExplosiveScatterPlan;
  readonly status: D6ExplosiveWorkflowStatus;
  readonly regionId: string;
  readonly tokenId: string;
  readonly userId: string;
  readonly visualColor: string;
}

export function transitionD6ExplosiveRegion(
  state: D6ExplosiveRegionStateV1,
  expectedRevision: number,
  changes: Partial<
    Pick<
      D6ExplosiveRegionStateV1,
      | "affectedTargets"
      | "attackHit"
      | "attackMessageId"
      | "resolvedPoint"
      | "scatter"
      | "status"
    >
  >,
): D6ExplosiveRegionStateV1 {
  if (state.revision !== expectedRevision)
    throw new RangeError("D6E2.Explosive.Error.RevisionConflict");
  const nextStatus = changes.status ?? state.status;
  const allowed: Record<
    D6ExplosiveWorkflowStatus,
    readonly D6ExplosiveWorkflowStatus[]
  > = {
    aiming: ["armed", "resolved", "cancelled"],
    armed: ["resolved", "detonated", "cancelled"],
    resolved: ["detonated", "cancelled"],
    detonated: ["detonated"],
    cancelled: ["cancelled"],
  };
  if (
    nextStatus !== state.status &&
    !allowed[state.status].includes(nextStatus)
  )
    throw new RangeError("D6E2.Explosive.Error.StateTransition");
  return Object.freeze({
    ...state,
    ...changes,
    affectedTargets: Object.freeze(
      changes.affectedTargets ?? state.affectedTargets,
    ),
    revision: state.revision + 1,
  });
}

export function parseD6ExplosiveRegionState(
  value: unknown,
): D6ExplosiveRegionStateV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  const stringKeys = [
    "actorUuid",
    "itemUuid",
    "requestId",
    "regionId",
    "sceneId",
    "tokenId",
    "userId",
    "visualColor",
  ] as const;
  if (
    state.schema !== D6_EXPLOSIVE_REGION_STATE_SCHEMA ||
    !stringKeys.every(
      (key) => typeof state[key] === "string" && state[key].length > 0,
    ) ||
    !Number.isInteger(state.revision) ||
    Number(state.revision) < 0 ||
    !Number.isInteger(state.difficulty) ||
    Number(state.difficulty) < 0 ||
    !["aiming", "armed", "resolved", "detonated", "cancelled"].includes(
      String(state.status),
    ) ||
    !validPoint(state.origin) ||
    !validPoint(state.aimedPoint) ||
    !validPoint(state.resolvedPoint) ||
    !validRange(state.range) ||
    !Array.isArray(state.affectedTargets) ||
    !state.affectedTargets.every(validAffectedTarget)
  )
    return null;
  try {
    normalizeD6BlastProfile(state.blastProfile);
  } catch {
    return null;
  }
  return value as D6ExplosiveRegionStateV1;
}

function validPoint(value: unknown): value is D6CanvasPoint {
  const point = value as Partial<D6CanvasPoint> | null;
  return Boolean(
    point &&
    typeof point === "object" &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y),
  );
}

function validRange(value: unknown): value is D6ExplosiveRangeResolution {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const range = value as Partial<D6ExplosiveRangeResolution>;
  return (
    (range.band === null ||
      ["point-blank", "short", "medium", "long"].includes(
        String(range.band),
      )) &&
    Number.isFinite(range.distance) &&
    Number(range.distance) >= 0 &&
    Number.isFinite(range.maximumDistance) &&
    Number(range.maximumDistance) >= 0 &&
    typeof range.outOfRange === "boolean"
  );
}

function validAffectedTarget(
  value: unknown,
): value is D6ExplosiveAffectedTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const target = value as Partial<D6ExplosiveAffectedTarget>;
  return (
    typeof target.actorId === "string" &&
    target.actorId.length > 0 &&
    typeof target.label === "string" &&
    typeof target.tokenId === "string" &&
    target.tokenId.length > 0 &&
    typeof target.visible === "boolean" &&
    [1, 2, 3, 4].includes(Number(target.zone))
  );
}

export function d6ExplosiveFinalPoint(input: {
  readonly aimedPoint: D6CanvasPoint;
  readonly hit: boolean;
  readonly origin: D6CanvasPoint;
  readonly pixelsPerMeter: number;
  readonly scatter?: D6ExplosiveScatterPlan;
}): D6CanvasPoint {
  if (input.hit) return Object.freeze({ ...input.aimedPoint });
  if (!input.scatter)
    throw new RangeError("D6E2.Explosive.Error.ScatterRequired");
  const base = Math.atan2(
    input.aimedPoint.y - input.origin.y,
    input.aimedPoint.x - input.origin.x,
  );
  const angle = base + (input.scatter.bearingDegrees * Math.PI) / 180;
  const distance = input.scatter.distanceMeters * input.pixelsPerMeter;
  return Object.freeze({
    x: input.aimedPoint.x + Math.cos(angle) * distance,
    y: input.aimedPoint.y + Math.sin(angle) * distance,
  });
}
