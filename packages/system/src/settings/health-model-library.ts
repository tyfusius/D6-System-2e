import {
  D6_HEALTH_DAMAGE_STRATEGIES,
  D6_HEALTH_MODEL_CONTRACT_VERSION,
  FIRST_EDITION_WOUND_LEVELS,
  SECOND_EDITION_CONDITIONS,
  firstEditionWoundPenaltyScore,
  secondEditionConditionPenaltyScore,
  type D6HealthModelV1,
  type D6HealthTrackStateV1,
  type D6RulesProfileV2,
  type D6System2eHealthModelRegistry,
  type FirstEditionDamageMode,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";

export const SECOND_EDITION_CONDITION_TRACK_MODEL_ID =
  "d6e2.health.condition-track" as const;
export const OPEN_D6_WOUND_TRACK_MODEL_ID =
  "open-d6.health.wound-track" as const;
export const OPEN_D6_BODY_POINT_POOL_MODEL_ID =
  "open-d6.health.body-points" as const;
export const OPEN_D6_BODY_POINT_HYBRID_MODEL_ID =
  "open-d6.health.body-points-with-wounds" as const;
export const OPEN_D6_LEGACY_HEALTH_MODEL_ID =
  "open-d6.health.wounds-or-body-points" as const;

const ID_PATTERN = /^[a-z][a-z0-9.-]*$/u;
const LEGACY_OPEN_D6_DAMAGE_MODE_SETTING = "firstEditionBodyPoints" as const;
const moduleModels = new Map<string, ReadonlyMap<string, D6HealthModelV1>>();
const MODEL_KIND_BY_DAMAGE_STRATEGY = Object.freeze({
  "d6e2.damage.conditions": "track",
  "open-d6.damage.wounds": "track",
  "open-d6.damage.body-points": "pool",
  "open-d6.damage.body-points-with-wounds": "hybrid",
} as const);

function trackStates(
  ids: readonly string[],
  penalty: (id: never) => number,
): readonly D6HealthTrackStateV1[] {
  return Object.freeze(
    ids.map((id) =>
      Object.freeze({
        id,
        label: `D6E2.Condition.${id
          .split("-")
          .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
          .join("")}`,
        penaltyScore: penalty(id as never),
        ...(id === "dead" ? { terminal: true } : {}),
      }),
    ),
  );
}

const SECOND_EDITION_TRACK = Object.freeze({
  initialStateId: "healthy",
  states: trackStates(
    SECOND_EDITION_CONDITIONS,
    secondEditionConditionPenaltyScore,
  ),
});
const OPEN_D6_TRACK = Object.freeze({
  initialStateId: "healthy",
  states: trackStates(
    FIRST_EDITION_WOUND_LEVELS,
    firstEditionWoundPenaltyScore,
  ),
});
const OPEN_D6_POOL = Object.freeze({
  maximumStrategyId: "open-d6.body-points.strength-roll-plus-20",
  permitsNegativeCurrent: true,
});

const bundled = Object.freeze<D6HealthModelV1[]>([
  Object.freeze({
    damageStrategyId: "d6e2.damage.conditions",
    description: "D6E2.Settings.HealthModel.SecondEdition.Description",
    id: SECOND_EDITION_CONDITION_TRACK_MODEL_ID,
    kind: "track",
    label: "D6E2.Settings.HealthModel.SecondEdition.Label",
    source: Object.freeze({ kind: "bundled" as const }),
    track: SECOND_EDITION_TRACK,
    version: D6_HEALTH_MODEL_CONTRACT_VERSION,
  }),
  Object.freeze({
    damageStrategyId: "open-d6.damage.wounds",
    description: "D6E2.Settings.HealthModel.OpenD6Wounds.Description",
    id: OPEN_D6_WOUND_TRACK_MODEL_ID,
    kind: "track",
    label: "D6E2.Settings.HealthModel.OpenD6Wounds.Label",
    source: Object.freeze({ kind: "bundled" as const }),
    track: OPEN_D6_TRACK,
    version: D6_HEALTH_MODEL_CONTRACT_VERSION,
  }),
  Object.freeze({
    damageStrategyId: "open-d6.damage.body-points",
    description: "D6E2.Settings.HealthModel.OpenD6BodyPoints.Description",
    id: OPEN_D6_BODY_POINT_POOL_MODEL_ID,
    kind: "pool",
    label: "D6E2.Settings.HealthModel.OpenD6BodyPoints.Label",
    pool: OPEN_D6_POOL,
    source: Object.freeze({ kind: "bundled" as const }),
    version: D6_HEALTH_MODEL_CONTRACT_VERSION,
  }),
  Object.freeze({
    damageStrategyId: "open-d6.damage.body-points-with-wounds",
    derivationStrategyId: "open-d6.body-points.percentage-wound-bands",
    description: "D6E2.Settings.HealthModel.OpenD6Hybrid.Description",
    id: OPEN_D6_BODY_POINT_HYBRID_MODEL_ID,
    kind: "hybrid",
    label: "D6E2.Settings.HealthModel.OpenD6Hybrid.Label",
    pool: OPEN_D6_POOL,
    source: Object.freeze({ kind: "bundled" as const }),
    track: OPEN_D6_TRACK,
    version: D6_HEALTH_MODEL_CONTRACT_VERSION,
  }),
]);

function normalizeStoredDamageMode(value: unknown): FirstEditionDamageMode {
  if (value === true || value === "true") return "body-points";
  if (value === "body-points-with-wounds") return value;
  if (value === "body-points") return value;
  return "wounds";
}

function legacyDamageMode(): FirstEditionDamageMode {
  try {
    return normalizeStoredDamageMode(
      game.settings.get(SYSTEM_ID, LEGACY_OPEN_D6_DAMAGE_MODE_SETTING),
    );
  } catch {
    return "wounds";
  }
}

export function availableHealthModels(): readonly D6HealthModelV1[] {
  return Object.freeze([
    ...bundled,
    ...Array.from(moduleModels.values()).flatMap((models) => [
      ...models.values(),
    ]),
  ]);
}

export function healthModelForStrategy(
  strategyId: string,
  fallbackMode: FirstEditionDamageMode = legacyDamageMode(),
): D6HealthModelV1 | null {
  const concreteId =
    strategyId === OPEN_D6_LEGACY_HEALTH_MODEL_ID
      ? fallbackMode === "body-points"
        ? OPEN_D6_BODY_POINT_POOL_MODEL_ID
        : fallbackMode === "body-points-with-wounds"
          ? OPEN_D6_BODY_POINT_HYBRID_MODEL_ID
          : OPEN_D6_WOUND_TRACK_MODEL_ID
      : strategyId;
  return availableHealthModels().find(({ id }) => id === concreteId) ?? null;
}

export function currentConfiguredHealthModel(
  profile: D6RulesProfileV2,
): D6HealthModelV1 {
  const fallback = healthModelForStrategy(
    SECOND_EDITION_CONDITION_TRACK_MODEL_ID,
  );
  if (!fallback)
    throw new Error("Bundled Condition Track model is unavailable");
  return healthModelForStrategy(profile.strategies.health) ?? fallback;
}

export function currentConfiguredHealthDamageMode(
  profile: D6RulesProfileV2,
): FirstEditionDamageMode {
  const model = healthModelForStrategy(profile.strategies.health);
  if (model?.kind === "pool") return "body-points";
  if (model?.kind === "hybrid") return "body-points-with-wounds";
  return "wounds";
}

export function configuredHealthDamageModeOverride(
  profile: D6RulesProfileV2,
): FirstEditionDamageMode | null {
  if (
    profile.strategies.health === OPEN_D6_LEGACY_HEALTH_MODEL_ID ||
    profile.strategies.health === SECOND_EDITION_CONDITION_TRACK_MODEL_ID
  )
    return null;
  const model = healthModelForStrategy(profile.strategies.health);
  if (!model) return null;
  if (model.kind === "pool") return "body-points";
  if (model.kind === "hybrid") return "body-points-with-wounds";
  return "wounds";
}

export function registerHealthModelContribution(
  ownerId: string,
  value: D6HealthModelV1,
): void {
  if (!ID_PATTERN.test(ownerId))
    throw new TypeError(`Invalid owner id: ${ownerId}`);
  if (!ID_PATTERN.test(value.id) || !value.id.startsWith(`${ownerId}.`))
    throw new TypeError(
      `Health model id must be owned by ${ownerId}: ${value.id}`,
    );
  if (bundled.some(({ id }) => id === value.id))
    throw new RangeError(`Bundled health model id is reserved: ${value.id}`);
  const normalized = structuredClone({
    ...value,
    source: { kind: "module", ownerId },
    version: D6_HEALTH_MODEL_CONTRACT_VERSION,
  }) as D6HealthModelV1;
  if (!D6_HEALTH_DAMAGE_STRATEGIES.includes(normalized.damageStrategyId))
    throw new TypeError(
      `Unsupported health damage strategy: ${normalized.damageStrategyId}`,
    );
  if (
    MODEL_KIND_BY_DAMAGE_STRATEGY[normalized.damageStrategyId] !==
    normalized.kind
  )
    throw new TypeError(
      `Health model ${normalized.id} cannot use ${normalized.damageStrategyId} with ${normalized.kind}`,
    );
  if (normalized.kind !== "pool") {
    const ids = normalized.track.states.map(({ id }) => id);
    if (
      ids.length === 0 ||
      ids.some((id) => !ID_PATTERN.test(id)) ||
      !ids.includes(normalized.track.initialStateId) ||
      new Set(ids).size !== ids.length
    )
      throw new TypeError(`Invalid health track: ${normalized.id}`);
    const supportedIds =
      normalized.damageStrategyId === "d6e2.damage.conditions"
        ? SECOND_EDITION_CONDITIONS
        : normalized.damageStrategyId === "open-d6.damage.wounds" ||
            normalized.damageStrategyId ===
              "open-d6.damage.body-points-with-wounds"
          ? FIRST_EDITION_WOUND_LEVELS
          : [];
    if (
      ids.length !== supportedIds.length ||
      ids.some((id, index) => id !== supportedIds[index])
    )
      throw new TypeError(
        `Health model ${normalized.id} must use the canonical states for ${normalized.damageStrategyId}`,
      );
  }
  const ownerModels = new Map(moduleModels.get(ownerId) ?? []);
  ownerModels.set(normalized.id, Object.freeze(normalized));
  moduleModels.set(ownerId, ownerModels);
  Hooks.callAll?.("d6e2HealthModelsChanged");
}

export function unregisterHealthModelOwner(ownerId: string): void {
  moduleModels.delete(ownerId);
  Hooks.callAll?.("d6e2HealthModelsChanged");
}

export function resetHealthModelLibraryForTests(): void {
  moduleModels.clear();
}

export const healthModelRegistry: D6System2eHealthModelRegistry = Object.freeze(
  {
    current: availableHealthModels,
    register: registerHealthModelContribution,
    unregisterOwner: unregisterHealthModelOwner,
  },
);
