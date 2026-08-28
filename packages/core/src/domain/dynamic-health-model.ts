import {
  D6_HEALTH_DAMAGE_OUTCOMES,
  D6_HEALTH_MODEL_CONTRACT_VERSION,
  D6_HEALTH_MODEL_MAX_PENALTY_SCORE,
  D6_HEALTH_MODEL_MAX_DAMAGE_RESULTS,
  D6_HEALTH_MODEL_MAX_STATES,
  D6_HEALTH_MODEL_MIN_DAMAGE_RESULTS,
  D6_HEALTH_MODEL_MIN_STATES,
  type D6HealthDamageResultV3,
  type D6HealthDamageStrategyId,
  type D6HealthModel,
  type D6HealthTrackStateV2,
} from "../contracts/health-models";

const PORTABLE_ID = /^[a-z][a-z0-9.-]*$/u;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safePenalty(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) &&
    numeric >= 0 &&
    numeric <= D6_HEALTH_MODEL_MAX_PENALTY_SCORE
    ? numeric
    : null;
}

function defaultResultLabel(id: string): string {
  if (id === "none") return "No Damage";
  return id
    .split("-")
    .map((part) => `${part[0]?.toLocaleUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export function healthDamageOutcomes(
  strategyId: D6HealthDamageStrategyId,
): readonly string[] {
  return D6_HEALTH_DAMAGE_OUTCOMES[strategyId];
}

export function defaultHealthDamageResults(
  strategyId: D6HealthDamageStrategyId,
): readonly D6HealthDamageResultV3[] {
  const openD6Ranges = [
    [Number.MIN_SAFE_INTEGER, 0],
    [1, 3],
    [4, 8],
    [9, 12],
    [13, 15],
    [16, undefined],
  ] as const;
  return Object.freeze(
    healthDamageOutcomes(strategyId).map((id, index) => {
      const range = openD6Ranges[index];
      if (strategyId === "open-d6.damage.wounds" && !range) {
        throw new RangeError(`Missing damage band: ${id}`);
      }
      const bandRange = range ?? [0, undefined];
      return Object.freeze({
        description: "",
        id,
        label: defaultResultLabel(id),
        rule:
          strategyId === "open-d6.damage.wounds"
            ? Object.freeze({
                band: Object.freeze({
                  minimum: bandRange[0],
                  ...(bandRange[1] === undefined
                    ? {}
                    : { maximum: bandRange[1] }),
                }),
                kind: "difference-band" as const,
              })
            : Object.freeze({
                kind: "strategy" as const,
                predicateId: `d6e2.${id}`,
              }),
      });
    }),
  );
}

function normalizeDamageResults(
  value: unknown,
  strategyId: D6HealthDamageStrategyId,
): readonly D6HealthDamageResultV3[] {
  const defaults = defaultHealthDamageResults(strategyId);
  if (!Array.isArray(value)) return defaults;
  if (
    value.length < D6_HEALTH_MODEL_MIN_DAMAGE_RESULTS ||
    value.length > D6_HEALTH_MODEL_MAX_DAMAGE_RESULTS
  ) {
    throw new RangeError(
      "Health tracks require between 2 and 8 damage results.",
    );
  }
  const normalized = value.map((raw, index) => {
    const source = record(raw);
    const id = text(source.id).toLocaleLowerCase();
    if (!PORTABLE_ID.test(id)) {
      throw new TypeError(`Damage result ${index + 1} requires a portable ID.`);
    }
    const label = text(source.label);
    if (!label) throw new TypeError(`Damage result ${id} requires a label.`);
    const rule = record(source.rule);
    if (rule.kind === "difference-band") {
      const band = record(rule.band);
      const minimum = Number(band.minimum);
      const maximum =
        band.maximum === undefined ? undefined : Number(band.maximum);
      if (
        !Number.isSafeInteger(minimum) ||
        (maximum !== undefined && !Number.isSafeInteger(maximum))
      ) {
        throw new TypeError(`Damage result ${id} has an invalid band.`);
      }
      return Object.freeze({
        description: text(source.description),
        id,
        label,
        rule: Object.freeze({
          band: Object.freeze({
            minimum,
            ...(maximum === undefined ? {} : { maximum }),
          }),
          kind: "difference-band" as const,
        }),
      });
    }
    if (rule.kind !== "strategy" || !text(rule.predicateId)) {
      throw new TypeError(`Damage result ${id} requires a valid rule.`);
    }
    return Object.freeze({
      description: text(source.description),
      id,
      label,
      rule: Object.freeze({
        kind: "strategy" as const,
        predicateId: text(rule.predicateId),
      }),
    });
  });
  if (new Set(normalized.map(({ id }) => id)).size !== normalized.length) {
    throw new TypeError("Damage result IDs must be unique.");
  }
  if (
    new Set(normalized.map(({ label }) => label.toLocaleLowerCase())).size !==
    normalized.length
  ) {
    throw new TypeError("Damage result labels must be unique.");
  }
  const ruleKinds = new Set(normalized.map(({ rule }) => rule.kind));
  if (ruleKinds.size !== 1) {
    throw new TypeError(
      "Damage results cannot mix bands and strategy predicates.",
    );
  }
  if (normalized.every(({ rule }) => rule.kind === "difference-band")) {
    normalized.forEach((result, index) => {
      if (result.rule.kind !== "difference-band") return;
      const { minimum, maximum } = result.rule.band;
      if (index === 0 && minimum !== Number.MIN_SAFE_INTEGER) {
        throw new TypeError(
          "The first damage-result band must cover all negative differences.",
        );
      }
      if (index === normalized.length - 1) {
        if (maximum !== undefined) {
          throw new TypeError(
            "The final damage-result band must be open-ended.",
          );
        }
      } else {
        const next = normalized[index + 1];
        if (
          maximum === undefined ||
          maximum < minimum ||
          next?.rule.kind !== "difference-band" ||
          next.rule.band.minimum !== maximum + 1
        ) {
          throw new TypeError(
            "Damage-result bands must be continuous and non-overlapping.",
          );
        }
      }
    });
  } else {
    const expectedPredicates = defaults.map(({ rule }) =>
      rule.kind === "strategy" ? rule.predicateId : "",
    );
    const predicates = normalized.map(({ rule }) =>
      rule.kind === "strategy" ? rule.predicateId : "",
    );
    if (
      predicates.length !== expectedPredicates.length ||
      new Set(predicates).size !== predicates.length ||
      expectedPredicates.some((predicate) => !predicates.includes(predicate))
    ) {
      throw new TypeError(
        "Strategy damage results must retain every engine predicate exactly once.",
      );
    }
  }
  return Object.freeze(normalized);
}

export function generateMonotonicDamageTransitions(
  states: readonly Pick<D6HealthTrackStateV2, "id" | "terminal">[],
  outcomes: readonly string[],
): Readonly<Record<string, Readonly<Record<string, string>>>> {
  if (states.length < D6_HEALTH_MODEL_MIN_STATES) {
    throw new RangeError("A health track requires at least two states.");
  }
  const last = states.length - 1;
  return Object.freeze(
    Object.fromEntries(
      states.map((state, stateIndex) => [
        state.id,
        Object.freeze(
          Object.fromEntries(
            outcomes.map((outcome, outcomeIndex) => {
              if (state.terminal) return [outcome, state.id];
              if (outcome === "none") return [outcome, state.id];
              const severityIndex = Math.max(
                1,
                Math.ceil(
                  ((outcomeIndex + 1) * last) / Math.max(1, outcomes.length),
                ),
              );
              return [
                outcome,
                states[Math.min(last, Math.max(stateIndex + 1, severityIndex))]
                  ?.id ?? state.id,
              ];
            }),
          ),
        ),
      ]),
    ),
  );
}

function validateRoundStartTransitions(
  states: readonly D6HealthTrackStateV2[],
): void {
  const byId = new Map(states.map((state) => [state.id, state]));
  for (const origin of states) {
    const targetId = origin.roundStartStateId;
    if (!targetId) continue;
    if (!byId.has(targetId)) {
      throw new TypeError(`Unknown round-start target: ${targetId}`);
    }
    const visited = new Set([origin.id]);
    let cursor = targetId;
    while (cursor) {
      if (visited.has(cursor)) {
        throw new TypeError(`Cyclic round-start transition: ${origin.id}`);
      }
      visited.add(cursor);
      cursor = byId.get(cursor)?.roundStartStateId ?? "";
    }
  }
}

/** Strict normalization for an atomic world-owned health-model write. */
export function normalizeWorldHealthModel(
  value: unknown,
  profileId: string,
): D6HealthModel {
  const source = record(value);
  const id = text(source.id).toLocaleLowerCase();
  const expectedPrefix = `${profileId}.health.`;
  if (!PORTABLE_ID.test(id) || !id.startsWith(expectedPrefix)) {
    throw new TypeError(`Health model id must be owned by ${profileId}: ${id}`);
  }
  const damageStrategyId = text(
    source.damageStrategyId,
  ) as D6HealthDamageStrategyId;
  if (
    damageStrategyId !== "d6e2.damage.conditions" &&
    damageStrategyId !== "open-d6.damage.wounds"
  ) {
    throw new TypeError("World health models require a track damage strategy.");
  }
  const track = record(source.track);
  const rawStates = Array.isArray(track.states) ? track.states : [];
  if (
    rawStates.length < D6_HEALTH_MODEL_MIN_STATES ||
    rawStates.length > D6_HEALTH_MODEL_MAX_STATES
  ) {
    throw new RangeError("Health tracks require between 2 and 20 states.");
  }
  const states = rawStates.map((raw): D6HealthTrackStateV2 => {
    const state = record(raw);
    const stateId = text(state.id).toLocaleLowerCase();
    const penaltyScore = safePenalty(state.penaltyScore);
    if (!PORTABLE_ID.test(stateId) || penaltyScore === null) {
      throw new TypeError(`Invalid health state: ${stateId}`);
    }
    const description = text(state.description);
    return Object.freeze({
      allowsActions: state.allowsActions === true,
      ...(description ? { description } : {}),
      id: stateId,
      label: text(state.label) || stateId,
      penaltyScore,
      ...(text(state.roundStartStateId)
        ? { roundStartStateId: text(state.roundStartStateId) }
        : {}),
      terminal: state.terminal === true,
    });
  });
  const ids = states.map(({ id: stateId }) => stateId);
  if (new Set(ids).size !== ids.length) {
    throw new TypeError("Health state ids must be unique.");
  }
  const initialStateId = text(track.initialStateId);
  const initial = states.find(({ id: stateId }) => stateId === initialStateId);
  if (!initial || initial.terminal) {
    throw new TypeError(
      "The initial health state must exist and be non-terminal.",
    );
  }
  if (!states.some(({ terminal }) => terminal)) {
    throw new TypeError("A health track requires a terminal state.");
  }
  validateRoundStartTransitions(states);

  const damageResults = normalizeDamageResults(
    track.damageResults,
    damageStrategyId,
  );
  const outcomes = damageResults.map(({ id: outcomeId }) => outcomeId);
  const rawTransitions = record(track.damageTransitions);
  const extraRows = Object.keys(rawTransitions).filter(
    (stateId) => !ids.includes(stateId),
  );
  if (extraRows.length > 0) {
    throw new TypeError(`Unknown transition state: ${extraRows[0]}`);
  }
  for (const state of states) {
    const row = record(rawTransitions[state.id]);
    const extra = Object.keys(row).filter(
      (outcome) => !outcomes.includes(outcome),
    );
    if (extra.length > 0) {
      throw new TypeError(`Unknown damage outcome: ${extra[0]}`);
    }
    for (const outcome of outcomes) {
      const targetId = text(row[outcome]);
      if (!ids.includes(targetId)) {
        throw new TypeError(
          `Missing or invalid transition ${state.id}/${outcome}`,
        );
      }
      if (state.terminal && targetId !== state.id) {
        throw new TypeError(
          `Terminal state ${state.id} cannot transition through damage.`,
        );
      }
    }
  }
  const damageTransitions = Object.freeze(
    Object.fromEntries(
      Object.entries(rawTransitions).map(([stateId, rawRow]) => [
        stateId,
        Object.freeze(
          Object.fromEntries(
            Object.entries(record(rawRow)).map(([outcome, targetId]) => [
              outcome,
              text(targetId),
            ]),
          ),
        ),
      ]),
    ),
  );
  return Object.freeze({
    damageStrategyId,
    description: text(source.description),
    id,
    kind: "track",
    label: text(source.label) || id,
    source: Object.freeze({ kind: "world" as const }),
    track: Object.freeze({
      damageResults,
      damageTransitions,
      initialStateId,
      ruleProvenance:
        source.version === D6_HEALTH_MODEL_CONTRACT_VERSION &&
        ["authored", "generated", "mixed", "preset"].includes(
          text(track.ruleProvenance),
        )
          ? (text(track.ruleProvenance) as
              "authored" | "generated" | "mixed" | "preset")
          : "authored",
      states: Object.freeze(states),
    }),
    version: D6_HEALTH_MODEL_CONTRACT_VERSION,
  });
}

export function nextHealthStateForDamage(
  model: Extract<D6HealthModel, { readonly kind: "track" }>,
  currentStateId: string,
  outcome: string,
): string {
  return (
    model.track.damageTransitions[currentStateId]?.[outcome] ??
    model.track.initialStateId
  );
}

export function nextHealthStateAtRoundStart(
  model: Extract<D6HealthModel, { readonly kind: "track" }>,
  currentStateId: string,
): string {
  const current = model.track.states.find(({ id }) => id === currentStateId);
  return (
    current?.roundStartStateId ?? current?.id ?? model.track.initialStateId
  );
}
