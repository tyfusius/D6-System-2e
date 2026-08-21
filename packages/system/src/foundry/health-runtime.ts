import {
  D6_ACTOR_HEALTH_PROJECTION_VERSION,
  firstEditionBodyPointWound,
  healthTrackStorageKey,
  isFirstEditionWoundLevel,
  isSecondEditionCondition,
  nextHealthStateAtRoundStart,
  nextHealthStateForDamage,
  type D6ActorHealthProjectionV1,
  type D6ConditionCommandOptions,
  type D6HealthDamageStrategyId,
  type D6HealthModelV2,
  type D6HealthProjectionCommandResultV1,
  type D6HealthTrackCommandResultV1,
  type FirstEditionBodyPointState,
} from "@d6-system-2e/core";
import {
  currentConfiguredHealthModel,
  healthModelForStrategy,
  SECOND_EDITION_CONDITION_TRACK_MODEL_ID,
} from "../settings/health-model-library";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import {
  setActorCondition,
  setActorFirstEditionWound,
} from "./condition-service";
import {
  damageActorFirstEditionBodyPoints,
  healActorFirstEditionBodyPoints,
  readActorFirstEditionBodyPoints,
  setActorFirstEditionBodyPoints,
} from "./first-edition-body-point-service";
import { record } from "./sheets/values";

export interface D6ActorHealthLifecycleStrategy {
  readonly accumulatingStuns: "none" | "open-d6.optional-accumulating-stuns";
  readonly mortality: "none" | "open-d6.elapsed-rounds";
  readonly roundStartRecovery: "d6e2.transient-conditions" | "none";
}

const SECOND_EDITION_HEALTH_LIFECYCLE = Object.freeze({
  accumulatingStuns: "none",
  mortality: "none",
  roundStartRecovery: "d6e2.transient-conditions",
} as const satisfies D6ActorHealthLifecycleStrategy);

const OPEN_D6_HEALTH_LIFECYCLE = Object.freeze({
  accumulatingStuns: "open-d6.optional-accumulating-stuns",
  mortality: "open-d6.elapsed-rounds",
  roundStartRecovery: "none",
} as const satisfies D6ActorHealthLifecycleStrategy);

export type D6ActorHealthResolutionStrategy = Readonly<
  | {
      id: "d6e2.damage.conditions";
      family: "conditions";
      resistance: "brawn-and-armor";
      trackEditable: true;
      lifecycle: typeof SECOND_EDITION_HEALTH_LIFECYCLE;
    }
  | {
      id: "open-d6.damage.wounds";
      family: "wounds";
      resistance: "brawn-and-armor";
      trackEditable: true;
      lifecycle: typeof OPEN_D6_HEALTH_LIFECYCLE;
    }
  | {
      id: "open-d6.damage.body-points";
      family: "body-points";
      resistance: "armor-only";
      trackEditable: false;
      woundDerivation: false;
      lifecycle: typeof OPEN_D6_HEALTH_LIFECYCLE;
    }
  | {
      id: "open-d6.damage.body-points-with-wounds";
      family: "body-points";
      resistance: "armor-only";
      trackEditable: false;
      woundDerivation: true;
      lifecycle: typeof OPEN_D6_HEALTH_LIFECYCLE;
    }
>;

export function healthResolutionStrategy(
  damageStrategyId: D6HealthDamageStrategyId,
): D6ActorHealthResolutionStrategy {
  switch (damageStrategyId) {
    case "d6e2.damage.conditions":
      return Object.freeze({
        family: "conditions",
        id: damageStrategyId,
        lifecycle: SECOND_EDITION_HEALTH_LIFECYCLE,
        resistance: "brawn-and-armor",
        trackEditable: true,
      });
    case "open-d6.damage.wounds":
      return Object.freeze({
        family: "wounds",
        id: damageStrategyId,
        lifecycle: OPEN_D6_HEALTH_LIFECYCLE,
        resistance: "brawn-and-armor",
        trackEditable: true,
      });
    case "open-d6.damage.body-points":
      return Object.freeze({
        family: "body-points",
        id: damageStrategyId,
        lifecycle: OPEN_D6_HEALTH_LIFECYCLE,
        resistance: "armor-only",
        trackEditable: false,
        woundDerivation: false,
      });
    case "open-d6.damage.body-points-with-wounds":
      return Object.freeze({
        family: "body-points",
        id: damageStrategyId,
        lifecycle: OPEN_D6_HEALTH_LIFECYCLE,
        resistance: "armor-only",
        trackEditable: false,
        woundDerivation: true,
      });
  }
}

export function currentHealthResolutionStrategy(): D6ActorHealthResolutionStrategy {
  return healthResolutionStrategy(
    currentConfiguredHealthModel(currentConfiguredRulesProfile())
      .damageStrategyId,
  );
}

function actorSource(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (typeof actor.system !== "object") {
    throw new TypeError("The health runtime requires an Actor-shaped source.");
  }
  return actor as FoundryActorDocument;
}

function commandActor(value: object): FoundryActorDocument {
  const actor = actorSource(value);
  if (typeof actor.id !== "string" || typeof actor.update !== "function") {
    throw new TypeError(
      "The health command requires a Foundry Actor document.",
    );
  }
  if (actor.isOwner !== true) throw new Error("D6E2.Condition.OwnerRequired");
  return actor;
}

function activeModel(actor: FoundryActorDocument): D6HealthModelV2 {
  if (["starship", "vehicle"].includes(actor.type)) {
    const machineModel = healthModelForStrategy(
      SECOND_EDITION_CONDITION_TRACK_MODEL_ID,
    );
    if (machineModel) return machineModel;
  }
  return currentConfiguredHealthModel(currentConfiguredRulesProfile());
}

function trackProjection(
  model: Exclude<D6HealthModelV2, { readonly kind: "pool" }>,
  storedStateId: string,
): NonNullable<D6ActorHealthProjectionV1["track"]> {
  const currentState =
    model.track.states.find(({ id }) => id === storedStateId) ??
    model.track.states.find(({ id }) => id === model.track.initialStateId) ??
    model.track.states[0];
  if (!currentState) throw new Error(`Health model has no states: ${model.id}`);
  return Object.freeze({
    currentState,
    currentStateId: currentState.id,
    states: model.track.states,
  });
}

function storedTrackState(
  health: Record<string, unknown>,
  modelId: string,
): string | null {
  const tracks = record(health.tracks);
  const stateId = record(
    tracks[healthTrackStorageKey(modelId)] ?? tracks[modelId],
  ).stateId;
  return typeof stateId === "string" ? stateId : null;
}

function personalActor(actor: FoundryActorDocument): boolean {
  return ["character", "creature", "npc"].includes(actor.type);
}

async function persistPersonalTrackState(
  actor: FoundryActorDocument,
  modelId: string,
  stateId: string,
): Promise<void> {
  if (!personalActor(actor)) return;
  const health = record(actor.system.health);
  const tracks = structuredClone(record(health.tracks));
  const storageKey = healthTrackStorageKey(modelId);
  tracks[storageKey] = { ...record(tracks[storageKey]), stateId };
  await actor.update({ "system.health.tracks": tracks });
}

export function readActorHealth(actorValue: object): D6ActorHealthProjectionV1 {
  const actor = actorSource(actorValue);
  const model = activeModel(actor);
  const health = record(actor.system.health);
  const bodyPoints =
    model.kind === "track"
      ? undefined
      : Object.freeze(readActorFirstEditionBodyPoints(actor));
  const trackStateId = (() => {
    const stored = storedTrackState(health, model.id);
    if (
      model.kind !== "pool" &&
      stored &&
      model.track.states.some(({ id }) => id === stored)
    ) {
      return stored;
    }
    if (model.kind !== "pool" && stored !== null) {
      return model.track.initialStateId;
    }
    if (
      model.kind === "track" &&
      ![
        SECOND_EDITION_CONDITION_TRACK_MODEL_ID,
        "open-d6.health.wound-track",
      ].includes(model.id)
    ) {
      return model.track.initialStateId;
    }
    switch (model.damageStrategyId) {
      case "d6e2.damage.conditions":
        return isSecondEditionCondition(health.condition)
          ? health.condition
          : model.kind === "pool"
            ? ""
            : model.track.initialStateId;
      case "open-d6.damage.wounds":
        return isFirstEditionWoundLevel(health.firstEditionWound)
          ? health.firstEditionWound
          : model.kind === "pool"
            ? ""
            : model.track.initialStateId;
      case "open-d6.damage.body-points-with-wounds":
        return bodyPoints
          ? firstEditionBodyPointWound(bodyPoints.current, bodyPoints.maximum)
          : "healthy";
      case "open-d6.damage.body-points":
        return "";
    }
  })();
  return Object.freeze({
    contractVersion: D6_ACTOR_HEALTH_PROJECTION_VERSION,
    damageStrategyId: model.damageStrategyId,
    kind: model.kind,
    modelId: model.id,
    modelLabel: model.label,
    ...(bodyPoints ? { pool: bodyPoints } : {}),
    ...(model.kind === "pool"
      ? {}
      : { track: trackProjection(model, trackStateId) }),
  });
}

export function actorHealthResolutionStrategy(
  actorValue: object,
): D6ActorHealthResolutionStrategy {
  return healthResolutionStrategy(readActorHealth(actorValue).damageStrategyId);
}

export async function setActorHealthTrack(
  actorValue: object,
  proposedStateId: string,
  options: D6ConditionCommandOptions = {},
): Promise<D6HealthTrackCommandResultV1> {
  const actor = commandActor(actorValue);
  const previous = readActorHealth(actor);
  if (!previous.track) throw new RangeError("D6E2.Health.TrackUnavailable");
  if (previous.kind === "hybrid")
    throw new RangeError("D6E2.Health.DerivedTrackReadOnly");
  if (!previous.track.states.some(({ id }) => id === proposedStateId))
    throw new RangeError("D6E2.Condition.Invalid");
  let heroPointSpent: 0 | 1 = 0;
  let prevented = false;
  if (previous.damageStrategyId === "d6e2.damage.conditions") {
    if (previous.modelId === SECOND_EDITION_CONDITION_TRACK_MODEL_ID) {
      if (!isSecondEditionCondition(proposedStateId))
        throw new RangeError("D6E2.Condition.Invalid");
      const result = await setActorCondition(actor, proposedStateId, options);
      heroPointSpent = result.heroPointSpent;
      prevented = result.prevented;
      await persistPersonalTrackState(actor, previous.modelId, result.current);
    } else {
      await persistPersonalTrackState(actor, previous.modelId, proposedStateId);
    }
  } else if (previous.damageStrategyId === "open-d6.damage.wounds") {
    if (previous.modelId === "open-d6.health.wound-track") {
      if (!isFirstEditionWoundLevel(proposedStateId))
        throw new RangeError("D6E2.Condition.Invalid");
      const result = await setActorFirstEditionWound(actor, proposedStateId);
      await persistPersonalTrackState(actor, previous.modelId, result.current);
    } else {
      await persistPersonalTrackState(actor, previous.modelId, proposedStateId);
    }
  } else {
    throw new RangeError("D6E2.Health.TrackUnavailable");
  }
  return Object.freeze({
    current: readActorHealth(actor),
    heroPointSpent,
    previous,
    prevented,
  });
}

export async function applyActorHealthDamageOutcome(
  actorValue: object,
  outcome: string,
  options: D6ConditionCommandOptions = {},
): Promise<D6HealthTrackCommandResultV1> {
  const actor = commandActor(actorValue);
  const previous = readActorHealth(actor);
  const model = activeModel(actor);
  if (!previous.track || model.kind !== "track") {
    throw new RangeError("D6E2.Health.TrackUnavailable");
  }
  const nextStateId = nextHealthStateForDamage(
    model,
    previous.track.currentStateId,
    outcome,
  );
  return setActorHealthTrack(actor, nextStateId, options);
}

export async function recoverActorRoundStartHealth(
  actorValue: object,
): Promise<boolean> {
  const actor = actorSource(actorValue);
  if (actor.isOwner !== true) return false;
  const previous = readActorHealth(actor);
  const model = activeModel(actor);
  if (!previous.track || model.kind !== "track") return false;
  const recovered = nextHealthStateAtRoundStart(
    model,
    previous.track.currentStateId,
  );
  if (recovered === previous.track.currentStateId) return false;
  await setActorHealthTrack(actor, recovered);
  return true;
}

function requirePool(
  projection: D6ActorHealthProjectionV1,
): FirstEditionBodyPointState {
  if (!projection.pool) throw new RangeError("D6E2.Health.PoolUnavailable");
  return projection.pool;
}

export async function setActorHealthPool(
  actorValue: object,
  proposed: FirstEditionBodyPointState,
): Promise<D6HealthProjectionCommandResultV1> {
  const actor = commandActor(actorValue);
  const previous = readActorHealth(actor);
  requirePool(previous);
  await setActorFirstEditionBodyPoints(actor, proposed);
  return Object.freeze({ current: readActorHealth(actor), previous });
}

export async function damageActorHealthPool(
  actorValue: object,
  amount: number,
): Promise<D6HealthProjectionCommandResultV1> {
  const actor = commandActor(actorValue);
  const previous = readActorHealth(actor);
  requirePool(previous);
  await damageActorFirstEditionBodyPoints(actor, amount);
  return Object.freeze({ current: readActorHealth(actor), previous });
}

export async function healActorHealthPool(
  actorValue: object,
  amount: number,
): Promise<D6HealthProjectionCommandResultV1> {
  const actor = commandActor(actorValue);
  const previous = readActorHealth(actor);
  requirePool(previous);
  await healActorFirstEditionBodyPoints(actor, amount);
  return Object.freeze({ current: readActorHealth(actor), previous });
}
