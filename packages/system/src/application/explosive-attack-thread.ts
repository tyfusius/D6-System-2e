import type { D6RollMode, D6RollResultV1 } from "@d6-system-2e/core";
import type { D6CanvasPoint } from "./explosive-workflow";
import {
  appendD6InitiatingActionResult,
  createD6InitiatingActionResultLedger,
  parseD6InitiatingActionResultLedger,
  type D6InitiatingActionResultLedgerV1,
  type D6InitiatingActionResultV1,
} from "./initiating-action-results";

export const D6_EXPLOSIVE_ATTACK_THREAD_SCHEMA = 1 as const;

export type D6ExplosiveZoneStage = "pending" | "rolling" | "rolled";
export type D6ExplosiveTargetStage =
  | "awaiting-damage"
  | "pending-resistance"
  | "resolving"
  | "applied"
  | "no-damage";

export interface D6ExplosiveThreadZoneV1 {
  readonly damageKind: "physical" | "stun";
  readonly damageScore: number;
  readonly result?: D6RollResultV1;
  readonly stage: D6ExplosiveZoneStage;
  readonly zone: 1 | 2 | 3 | 4;
}

export interface D6ExplosiveThreadTargetV1 {
  readonly actorId?: string;
  readonly actorImg?: string;
  readonly actorName?: string;
  readonly conditionLabel?: string;
  /** Stable health-model state id; omitted for redacted targets and legacy v1 threads. */
  readonly healthStateId?: string;
  readonly damageTotal?: number;
  readonly resistanceTotal?: number;
  readonly resistanceRoll?: {
    readonly baseFaces: readonly number[];
    readonly pool: { readonly dice: number; readonly pips: number };
    readonly resultModifier: number;
    readonly wildFaces: readonly number[];
    readonly wildOutcome: D6RollResultV1["wildOutcome"];
  };
  readonly bodyPointsCurrent?: number;
  readonly bodyPointsMaximum?: number;
  readonly stage: D6ExplosiveTargetStage;
  readonly targetKey: string;
  readonly tokenId?: string;
  readonly visible: boolean;
  readonly zone: 1 | 2 | 3 | 4;
}

export interface D6ExplosiveAttackThreadV1 {
  readonly aimedPoint: D6CanvasPoint;
  readonly attackHit: boolean;
  readonly attackMessageId: string;
  readonly regionId: string;
  readonly requestId: string;
  readonly results: D6InitiatingActionResultLedgerV1;
  readonly resolvedPoint: D6CanvasPoint;
  readonly revision: number;
  readonly rollMode: D6RollMode;
  readonly sceneId: string;
  readonly schema: typeof D6_EXPLOSIVE_ATTACK_THREAD_SCHEMA;
  readonly targets: readonly D6ExplosiveThreadTargetV1[];
  readonly zones: readonly D6ExplosiveThreadZoneV1[];
}

export interface D6ExplosiveThreadTargetInput {
  readonly actorId?: string;
  readonly actorImg?: string;
  readonly actorName?: string;
  readonly targetKey: string;
  readonly tokenId?: string;
  readonly visible: boolean;
  readonly zone: 1 | 2 | 3 | 4;
}

export function createD6ExplosiveAttackThread(input: {
  readonly aimedPoint: D6CanvasPoint;
  readonly attackHit: boolean;
  readonly attackMessageId: string;
  readonly damageKind: "physical" | "stun";
  readonly regionId: string;
  readonly requestId: string;
  readonly resolvedPoint: D6CanvasPoint;
  readonly rollMode: D6RollMode;
  readonly sceneId: string;
  readonly targets: readonly D6ExplosiveThreadTargetInput[];
  readonly zoneDamageScores: Readonly<Partial<Record<1 | 2 | 3 | 4, number>>>;
  readonly results?: D6InitiatingActionResultLedgerV1;
}): D6ExplosiveAttackThreadV1 {
  const occupiedZones = [
    ...new Set(input.targets.map(({ zone }) => zone)),
  ].sort((left, right) => left - right);
  const zones = occupiedZones.flatMap((zone) => {
    const damageScore = input.zoneDamageScores[zone];
    return Number.isInteger(damageScore) && Number(damageScore) >= 3
      ? [
          Object.freeze({
            damageKind: input.damageKind,
            damageScore: Number(damageScore),
            stage: "pending" as const,
            zone,
          }),
        ]
      : [];
  });
  const activeZones = new Set(zones.map(({ zone }) => zone));
  const targets = input.targets.map((target) =>
    Object.freeze({
      ...(target.visible && target.actorId ? { actorId: target.actorId } : {}),
      ...(target.visible && target.actorImg
        ? { actorImg: target.actorImg }
        : {}),
      ...(target.visible && target.actorName
        ? { actorName: target.actorName }
        : {}),
      ...(target.visible && target.tokenId ? { tokenId: target.tokenId } : {}),
      stage: activeZones.has(target.zone)
        ? ("awaiting-damage" as const)
        : ("no-damage" as const),
      targetKey: target.targetKey,
      visible: target.visible,
      zone: target.zone,
    }),
  );
  const results =
    input.results ??
    createD6InitiatingActionResultLedger(
      input.attackMessageId,
      input.requestId,
    );
  if (
    results.rootMessageId !== input.attackMessageId ||
    results.requestId !== input.requestId
  ) {
    throw new RangeError("D6E2.ActionThread.AuthorityMismatch");
  }
  return Object.freeze({
    aimedPoint: Object.freeze({ ...input.aimedPoint }),
    attackHit: input.attackHit,
    attackMessageId: required(input.attackMessageId),
    regionId: required(input.regionId),
    requestId: required(input.requestId),
    results,
    resolvedPoint: Object.freeze({ ...input.resolvedPoint }),
    revision: 0,
    rollMode: input.rollMode,
    sceneId: required(input.sceneId),
    schema: D6_EXPLOSIVE_ATTACK_THREAD_SCHEMA,
    targets: Object.freeze(targets),
    zones: Object.freeze(zones),
  });
}

export function claimD6ExplosiveZoneDamage(
  thread: D6ExplosiveAttackThreadV1,
  zone: 1 | 2 | 3 | 4,
): D6ExplosiveAttackThreadV1 {
  const current = thread.zones.find((entry) => entry.zone === zone);
  if (current?.stage !== "pending") {
    throw new RangeError("D6E2.Explosive.Thread.ZoneUnavailable");
  }
  return updateThread(thread, {
    zones: thread.zones.map((entry) =>
      entry.zone === zone
        ? Object.freeze({ ...entry, stage: "rolling" })
        : entry,
    ),
  });
}

export function releaseD6ExplosiveZoneDamage(
  thread: D6ExplosiveAttackThreadV1,
  zone: 1 | 2 | 3 | 4,
): D6ExplosiveAttackThreadV1 {
  const current = thread.zones.find((entry) => entry.zone === zone);
  if (current?.stage !== "rolling") return thread;
  return updateThread(thread, {
    zones: thread.zones.map((entry) =>
      entry.zone === zone
        ? Object.freeze({ ...entry, stage: "pending" })
        : entry,
    ),
  });
}

export function completeD6ExplosiveZoneDamage(
  thread: D6ExplosiveAttackThreadV1,
  zone: 1 | 2 | 3 | 4,
  result: D6RollResultV1,
  presentation?: D6InitiatingActionResultV1,
): D6ExplosiveAttackThreadV1 {
  const current = thread.zones.find((entry) => entry.zone === zone);
  if (current?.stage !== "rolling") {
    throw new RangeError("D6E2.Explosive.Thread.ZoneUnavailable");
  }
  return updateThread(thread, {
    ...(presentation
      ? {
          results: appendD6InitiatingActionResult(thread.results, presentation),
        }
      : {}),
    targets: thread.targets.map((target) =>
      target.zone === zone && target.stage === "awaiting-damage"
        ? Object.freeze({
            ...target,
            damageTotal: result.total,
            stage: "pending-resistance" as const,
          })
        : target,
    ),
    zones: thread.zones.map((entry) =>
      entry.zone === zone
        ? Object.freeze({ ...entry, result, stage: "rolled" as const })
        : entry,
    ),
  });
}

export function setD6ExplosiveTargetStage(
  thread: D6ExplosiveAttackThreadV1,
  targetKey: string,
  stage: "pending-resistance" | "resolving",
): D6ExplosiveAttackThreadV1 {
  const current = thread.targets.find(
    (target) => target.targetKey === targetKey,
  );
  if (
    !current ||
    !["pending-resistance", "resolving"].includes(current.stage)
  ) {
    throw new RangeError("D6E2.Explosive.Thread.TargetUnavailable");
  }
  return updateThread(thread, {
    targets: thread.targets.map((target) =>
      target.targetKey === targetKey
        ? Object.freeze({ ...target, stage })
        : target,
    ),
  });
}

export function completeD6ExplosiveTarget(
  thread: D6ExplosiveAttackThreadV1,
  targetKey: string,
  outcome: {
    readonly bodyPointsCurrent?: number;
    readonly bodyPointsMaximum?: number;
    readonly conditionLabel: string;
    readonly healthStateId: string;
    readonly resistanceRoll?: D6ExplosiveThreadTargetV1["resistanceRoll"];
    readonly resistanceTotal: number;
    readonly presentation?: D6InitiatingActionResultV1;
  },
): D6ExplosiveAttackThreadV1 {
  const current = thread.targets.find(
    (target) => target.targetKey === targetKey,
  );
  if (
    !current ||
    !["pending-resistance", "resolving"].includes(current.stage)
  ) {
    throw new RangeError("D6E2.Explosive.Thread.TargetUnavailable");
  }
  return updateThread(thread, {
    ...(outcome.presentation
      ? {
          results: appendD6InitiatingActionResult(
            thread.results,
            outcome.presentation,
          ),
        }
      : {}),
    targets: thread.targets.map((target) =>
      target.targetKey === targetKey
        ? Object.freeze({
            ...target,
            ...(target.visible && outcome.bodyPointsCurrent !== undefined
              ? { bodyPointsCurrent: outcome.bodyPointsCurrent }
              : {}),
            ...(target.visible && outcome.bodyPointsMaximum !== undefined
              ? { bodyPointsMaximum: outcome.bodyPointsMaximum }
              : {}),
            ...(target.visible
              ? {
                  conditionLabel: outcome.conditionLabel,
                  healthStateId: outcome.healthStateId,
                }
              : {}),
            ...(outcome.resistanceRoll
              ? { resistanceRoll: outcome.resistanceRoll }
              : {}),
            resistanceTotal: Math.trunc(outcome.resistanceTotal),
            stage: "applied" as const,
          })
        : target,
    ),
  });
}

export function d6ExplosiveAttackThreadComplete(
  thread: D6ExplosiveAttackThreadV1,
): boolean {
  return (
    thread.zones.every(({ stage }) => stage === "rolled") &&
    thread.targets.every(({ stage }) =>
      ["applied", "no-damage"].includes(stage),
    )
  );
}

/** A browser reload cannot preserve an open Damage or Resistance dialog. Only
 * uncommitted in-flight stages are returned to their reopenable durable state;
 * completed roll and Health evidence is never altered. */
export function recoverD6ExplosiveAttackThread(
  thread: D6ExplosiveAttackThreadV1,
): D6ExplosiveAttackThreadV1 {
  const zones = thread.zones.map((zone) =>
    zone.stage === "rolling"
      ? Object.freeze({ ...zone, stage: "pending" as const })
      : zone,
  );
  const targets = thread.targets.map((target) =>
    target.stage === "resolving"
      ? Object.freeze({ ...target, stage: "pending-resistance" as const })
      : target,
  );
  return zones.some((zone, index) => zone !== thread.zones[index]) ||
    targets.some((target, index) => target !== thread.targets[index])
    ? updateThread(thread, { targets, zones })
    : thread;
}

export function parseD6ExplosiveAttackThread(
  value: unknown,
): D6ExplosiveAttackThreadV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const thread = value as Partial<D6ExplosiveAttackThreadV1>;
  if (
    thread.schema !== D6_EXPLOSIVE_ATTACK_THREAD_SCHEMA ||
    !nonEmpty(thread.attackMessageId) ||
    !nonEmpty(thread.regionId) ||
    !nonEmpty(thread.requestId) ||
    !nonEmpty(thread.sceneId) ||
    !Number.isInteger(thread.revision) ||
    Number(thread.revision) < 0 ||
    !point(thread.aimedPoint) ||
    !point(thread.resolvedPoint) ||
    !["blindroll", "gmroll", "publicroll", "selfroll"].includes(
      String(thread.rollMode),
    ) ||
    !Array.isArray(thread.zones) ||
    !thread.zones.every(validZone) ||
    !Array.isArray(thread.targets) ||
    !thread.targets.every(validTarget)
  ) {
    return null;
  }
  const results =
    thread.results === undefined
      ? createD6InitiatingActionResultLedger(
          thread.attackMessageId,
          thread.requestId,
        )
      : parseD6InitiatingActionResultLedger(thread.results);
  if (!results) return null;
  if (
    results.rootMessageId !== thread.attackMessageId ||
    results.requestId !== thread.requestId
  ) {
    return null;
  }
  return Object.freeze({ ...thread, results }) as D6ExplosiveAttackThreadV1;
}

function updateThread(
  thread: D6ExplosiveAttackThreadV1,
  changes: Pick<
    Partial<D6ExplosiveAttackThreadV1>,
    "results" | "targets" | "zones"
  >,
): D6ExplosiveAttackThreadV1 {
  return Object.freeze({
    ...thread,
    ...changes,
    revision: thread.revision + 1,
    targets: Object.freeze(changes.targets ?? thread.targets),
    zones: Object.freeze(changes.zones ?? thread.zones),
  });
}

function required(value: string): string {
  if (!nonEmpty(value)) throw new RangeError("D6E2.Explosive.Thread.Invalid");
  return value;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function point(value: unknown): value is D6CanvasPoint {
  const candidate = value as Partial<D6CanvasPoint> | undefined;
  return Boolean(
    candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y),
  );
}

function validZone(value: unknown): value is D6ExplosiveThreadZoneV1 {
  const zone = value as Partial<D6ExplosiveThreadZoneV1> | undefined;
  return Boolean(
    zone &&
    [1, 2, 3, 4].includes(Number(zone.zone)) &&
    Number.isInteger(zone.damageScore) &&
    Number(zone.damageScore) >= 3 &&
    ["physical", "stun"].includes(String(zone.damageKind)) &&
    ["pending", "rolling", "rolled"].includes(String(zone.stage)) &&
    (zone.stage !== "rolled" || zone.result),
  );
}

function validTarget(value: unknown): value is D6ExplosiveThreadTargetV1 {
  const target = value as Partial<D6ExplosiveThreadTargetV1> | undefined;
  return Boolean(
    target &&
    nonEmpty(target.targetKey) &&
    [1, 2, 3, 4].includes(Number(target.zone)) &&
    typeof target.visible === "boolean" &&
    [
      "awaiting-damage",
      "pending-resistance",
      "resolving",
      "applied",
      "no-damage",
    ].includes(String(target.stage)) &&
    (!target.visible ||
      (nonEmpty(target.actorId) &&
        nonEmpty(target.actorName) &&
        nonEmpty(target.tokenId))) &&
    (target.resistanceRoll === undefined ||
      validResistanceEvidence(target.resistanceRoll)) &&
    (target.healthStateId === undefined || nonEmpty(target.healthStateId)),
  );
}

function validResistanceEvidence(value: unknown): boolean {
  const evidence = value as
    | Partial<NonNullable<D6ExplosiveThreadTargetV1["resistanceRoll"]>>
    | undefined;
  const pool = evidence?.pool;
  return Boolean(
    evidence &&
    Array.isArray(evidence.baseFaces) &&
    evidence.baseFaces.every(Number.isInteger) &&
    Array.isArray(evidence.wildFaces) &&
    evidence.wildFaces.every(Number.isInteger) &&
    Number.isInteger(pool?.dice) &&
    Number.isInteger(pool?.pips) &&
    Number.isInteger(evidence.resultModifier) &&
    [
      "normal",
      "exploded",
      "complication",
      "exceptional-success",
      "ordinary-success",
      "penalty",
      "partial-success",
      "failure",
      "unresolved-advantage",
      "unresolved-complication",
    ].includes(String(evidence.wildOutcome)),
  );
}
