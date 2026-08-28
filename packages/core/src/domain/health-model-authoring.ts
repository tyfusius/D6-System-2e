import type {
  D6HealthDamageResultV3,
  D6HealthDamageStrategyId,
  D6HealthModel,
  D6HealthTrackStateV2,
} from "../contracts/health-models";
import {
  generateMonotonicDamageTransitions,
  healthDamageOutcomes,
  nextHealthStateForDamage,
} from "./dynamic-health-model";

export { defaultHealthDamageResults } from "./dynamic-health-model";

export interface D6HealthTransitionDiffV1 {
  readonly currentStateId: string;
  readonly from?: string;
  readonly outcomeId: string;
  readonly to: string;
}

/** Generation is an explicit proposal. Calling this function never mutates a model. */
export function proposeMonotonicHealthTransitions(
  states: readonly Pick<D6HealthTrackStateV2, "id" | "terminal">[],
  strategyOrOutcomeIds: D6HealthDamageStrategyId | readonly string[],
) {
  return generateMonotonicDamageTransitions(
    states,
    typeof strategyOrOutcomeIds === "string"
      ? healthDamageOutcomes(strategyOrOutcomeIds)
      : strategyOrOutcomeIds,
  );
}

export function diffHealthTransitions(
  current: Readonly<Record<string, Readonly<Record<string, string>>>>,
  proposed: Readonly<Record<string, Readonly<Record<string, string>>>>,
): readonly D6HealthTransitionDiffV1[] {
  return Object.freeze(
    Object.entries(proposed).flatMap(([currentStateId, row]) =>
      Object.entries(row).flatMap(([outcomeId, to]) =>
        current[currentStateId]?.[outcomeId] === to
          ? []
          : (() => {
              const from = current[currentStateId]?.[outcomeId];
              return [
                Object.freeze({
                  currentStateId,
                  ...(from ? { from } : {}),
                  outcomeId,
                  to,
                }),
              ];
            })(),
      ),
    ),
  );
}

export function validateHealthDamageResults(
  results: readonly D6HealthDamageResultV3[],
  strategyId: D6HealthDamageStrategyId,
): readonly string[] {
  const errors: string[] = [];
  if (results.length < 2 || results.length > 8) {
    errors.push("Health tracks require between 2 and 8 damage results.");
  }
  const portableId = /^[a-z][a-z0-9.-]*$/u;
  if (results.some(({ id }) => !portableId.test(id))) {
    errors.push("Every damage result requires a portable ID.");
  }
  if (new Set(results.map(({ id }) => id)).size !== results.length) {
    errors.push("Damage result IDs must be unique.");
  }
  if (results.some(({ label }) => label.trim() === "")) {
    errors.push("Every damage result requires a label.");
  }
  if (
    new Set(results.map(({ label }) => label.trim().toLocaleLowerCase()))
      .size !== results.length
  ) {
    errors.push("Damage result labels must be unique.");
  }
  const bands = results.filter(
    (result) => result.rule.kind === "difference-band",
  );
  if (bands.length === 0) {
    const expectedPredicates = healthDamageOutcomes(strategyId).map(
      (id) => `d6e2.${id}`,
    );
    const predicates = results.map(({ rule }) =>
      rule.kind === "strategy" ? rule.predicateId : "",
    );
    if (
      predicates.length !== expectedPredicates.length ||
      new Set(predicates).size !== predicates.length ||
      expectedPredicates.some((predicate) => !predicates.includes(predicate))
    ) {
      errors.push(
        "Strategy damage results must retain every engine predicate exactly once.",
      );
    }
    return Object.freeze(errors);
  }
  if (bands.length !== results.length) {
    errors.push("Damage results cannot mix bands and strategy predicates.");
    return Object.freeze(errors);
  }
  for (let index = 0; index < bands.length; index += 1) {
    const result = bands[index];
    if (result?.rule.kind !== "difference-band") continue;
    const { minimum, maximum } = result.rule.band;
    if (index === 0 && minimum !== Number.MIN_SAFE_INTEGER) {
      errors.push(
        "The first damage-result band must cover all negative differences.",
      );
    }
    if (!Number.isSafeInteger(minimum)) {
      errors.push(`Damage result ${result.id} has an invalid minimum.`);
    }
    if (index === bands.length - 1) {
      if (maximum !== undefined) {
        errors.push("The last damage-result band must be open-ended.");
      }
      continue;
    }
    if (!Number.isSafeInteger(maximum) || (maximum ?? minimum - 1) < minimum) {
      errors.push(`Damage result ${result.id} has an inverted range.`);
      continue;
    }
    const next = bands[index + 1];
    if (
      next?.rule.kind === "difference-band" &&
      next.rule.band.minimum !== (maximum ?? 0) + 1
    ) {
      errors.push(
        `Damage-result bands ${result.id} and ${next.id} must be continuous.`,
      );
    }
  }
  return Object.freeze(errors);
}

export function healthDamageResultForStrategyPredicate(
  model: Extract<D6HealthModel, { readonly kind: "track" }>,
  predicateId: string,
): string | null {
  return (
    model.track.damageResults.find(
      ({ rule }) =>
        rule.kind === "strategy" && rule.predicateId === predicateId,
    )?.id ?? null
  );
}

export interface D6HealthSimulationInputV1 {
  readonly currentStateId: string;
  readonly damage?: number;
  readonly incomingResultId?: string;
  readonly resistance?: number;
}

export interface D6HealthSimulationResultV1 {
  readonly currentStateId: string;
  readonly damage?: number;
  readonly difference?: number;
  readonly incomingResultId: string;
  readonly nextStateId: string;
  readonly resistance?: number;
  readonly ruleSource: "difference-band" | "strategy";
}

export function healthSimulationRuleSource(
  model: Extract<D6HealthModel, { readonly kind: "track" }>,
): D6HealthSimulationResultV1["ruleSource"] {
  return model.track.damageResults.every(
    ({ rule }) => rule.kind === "difference-band",
  )
    ? "difference-band"
    : "strategy";
}

export function healthDamageResultForDifference(
  model: Extract<D6HealthModel, { readonly kind: "track" }>,
  difference: number,
): string | null {
  const normalized = Math.trunc(difference);
  return (
    model.track.damageResults.find(
      ({ rule }) =>
        rule.kind === "difference-band" &&
        normalized >= rule.band.minimum &&
        (rule.band.maximum === undefined || normalized <= rule.band.maximum),
    )?.id ?? null
  );
}

/** Pure preview using the same persisted transition matrix as runtime. */
export function simulateHealthModelDamage(
  model: Extract<D6HealthModel, { readonly kind: "track" }>,
  input: D6HealthSimulationInputV1,
): D6HealthSimulationResultV1 {
  const ruleSource = healthSimulationRuleSource(model);
  let difference: number | undefined;
  let incomingResultId: string;
  if (ruleSource === "difference-band") {
    if (input.incomingResultId !== undefined) {
      throw new RangeError(
        "A difference-band simulation cannot accept an incoming result.",
      );
    }
    const damage = input.damage;
    const resistance = input.resistance;
    if (!Number.isSafeInteger(damage) || !Number.isSafeInteger(resistance)) {
      throw new RangeError(
        "A difference-band simulation requires integer Damage and Resistance values.",
      );
    }
    difference = Math.trunc(damage ?? 0) - Math.trunc(resistance ?? 0);
    incomingResultId =
      healthDamageResultForDifference(model, difference) ??
      (() => {
        throw new RangeError(
          "The simulated difference does not match a damage-result band.",
        );
      })();
  } else {
    if (input.damage !== undefined || input.resistance !== undefined) {
      throw new RangeError(
        "A strategy simulation cannot accept Damage or Resistance values.",
      );
    }
    incomingResultId =
      input.incomingResultId ??
      (() => {
        throw new RangeError(
          "A strategy-based simulation requires an incoming result.",
        );
      })();
  }
  if (!model.track.damageResults.some(({ id }) => id === incomingResultId)) {
    throw new RangeError(
      `Unknown simulated damage result: ${incomingResultId}`,
    );
  }
  return Object.freeze({
    currentStateId: input.currentStateId,
    ...(difference === undefined
      ? {}
      : {
          damage: Math.trunc(input.damage ?? 0),
          difference,
          resistance: Math.trunc(input.resistance ?? 0),
        }),
    incomingResultId,
    nextStateId: nextHealthStateForDamage(
      model,
      input.currentStateId,
      incomingResultId,
    ),
    ruleSource,
  });
}
