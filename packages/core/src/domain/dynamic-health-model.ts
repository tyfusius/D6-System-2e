import {
  D6_HEALTH_DAMAGE_OUTCOMES,
  D6_HEALTH_MODEL_CONTRACT_VERSION,
  D6_HEALTH_MODEL_MAX_PENALTY_SCORE,
  D6_HEALTH_MODEL_MAX_STATES,
  D6_HEALTH_MODEL_MIN_STATES,
  type D6HealthDamageStrategyId,
  type D6HealthModelV2,
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

export function healthDamageOutcomes(
  strategyId: D6HealthDamageStrategyId,
): readonly string[] {
  return D6_HEALTH_DAMAGE_OUTCOMES[strategyId];
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
): D6HealthModelV2 {
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

  const outcomes = healthDamageOutcomes(damageStrategyId);
  const rawTransitions = record(track.damageTransitions);
  const damageTransitions = Object.freeze(
    Object.fromEntries(
      states.map((state) => {
        const row = record(rawTransitions[state.id]);
        const extra = Object.keys(row).filter(
          (outcome) => !outcomes.includes(outcome),
        );
        if (extra.length > 0) {
          throw new TypeError(`Unknown damage outcome: ${extra[0]}`);
        }
        const normalizedRow = Object.fromEntries(
          outcomes.map((outcome) => {
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
            return [outcome, targetId];
          }),
        );
        return [state.id, Object.freeze(normalizedRow)];
      }),
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
      damageTransitions,
      initialStateId,
      states: Object.freeze(states),
    }),
    version: D6_HEALTH_MODEL_CONTRACT_VERSION,
  });
}

export function nextHealthStateForDamage(
  model: Extract<D6HealthModelV2, { readonly kind: "track" }>,
  currentStateId: string,
  outcome: string,
): string {
  return (
    model.track.damageTransitions[currentStateId]?.[outcome] ??
    model.track.initialStateId
  );
}

export function nextHealthStateAtRoundStart(
  model: Extract<D6HealthModelV2, { readonly kind: "track" }>,
  currentStateId: string,
): string {
  const current = model.track.states.find(({ id }) => id === currentStateId);
  return (
    current?.roundStartStateId ?? current?.id ?? model.track.initialStateId
  );
}
