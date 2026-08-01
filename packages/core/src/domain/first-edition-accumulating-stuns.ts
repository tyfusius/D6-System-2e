export const FIRST_EDITION_ACCUMULATING_STUNS_VERSION = 1 as const;

export interface FirstEditionAccumulatingStunState {
  readonly version: typeof FIRST_EDITION_ACCUMULATING_STUNS_VERSION;
  readonly total: number;
  readonly penaltyDice: number;
  readonly roundsRemaining: number;
  readonly lastProcessedRoundId: string;
}

export interface FirstEditionAccumulatingStunApplication {
  readonly state: FirstEditionAccumulatingStunState;
  readonly threshold: number;
  readonly crossedThreshold: boolean;
  readonly immediatelyUnconscious: boolean;
}

function nonNegativeInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export function emptyFirstEditionAccumulatingStuns(): FirstEditionAccumulatingStunState {
  return {
    version: FIRST_EDITION_ACCUMULATING_STUNS_VERSION,
    total: 0,
    penaltyDice: 0,
    roundsRemaining: 0,
    lastProcessedRoundId: "",
  };
}

export function normalizeFirstEditionAccumulatingStuns(
  value: Partial<FirstEditionAccumulatingStunState> | null | undefined,
): FirstEditionAccumulatingStunState {
  const roundsRemaining = nonNegativeInteger(value?.roundsRemaining);
  return {
    version: FIRST_EDITION_ACCUMULATING_STUNS_VERSION,
    total: nonNegativeInteger(value?.total),
    penaltyDice:
      roundsRemaining > 0
        ? Math.min(2, nonNegativeInteger(value?.penaltyDice))
        : 0,
    roundsRemaining,
    lastProcessedRoundId:
      typeof value?.lastProcessedRoundId === "string"
        ? value.lastProcessedRoundId
        : "",
  };
}

export function firstEditionAccumulatingStunThreshold(
  strengthPipScore: number,
): number {
  return Math.max(1, Math.floor(nonNegativeInteger(strengthPipScore) / 3));
}

export function applyFirstEditionAccumulatingStun(
  current: Partial<FirstEditionAccumulatingStunState> | null | undefined,
  difference: number,
  strengthPipScore: number,
): FirstEditionAccumulatingStunApplication {
  const state = normalizeFirstEditionAccumulatingStuns(current);
  const incomingDifference = Math.trunc(difference);
  if (!Number.isFinite(incomingDifference) || incomingDifference <= 0) {
    return {
      state,
      threshold: firstEditionAccumulatingStunThreshold(strengthPipScore),
      crossedThreshold: false,
      immediatelyUnconscious: false,
    };
  }

  const threshold = firstEditionAccumulatingStunThreshold(strengthPipScore);
  const total = state.total + 1;
  const immediatelyUnconscious = incomingDifference >= 9;
  const penaltyDice = immediatelyUnconscious
    ? 0
    : Math.max(state.penaltyDice, incomingDifference >= 4 ? 2 : 1);

  return {
    state: {
      ...state,
      total,
      penaltyDice,
      roundsRemaining: immediatelyUnconscious
        ? 0
        : Math.max(state.roundsRemaining, 2),
    },
    threshold,
    crossedThreshold: state.total < threshold && total >= threshold,
    immediatelyUnconscious,
  };
}

export function recoverFirstEditionAccumulatingStunsAtRoundStart(
  current: Partial<FirstEditionAccumulatingStunState> | null | undefined,
  roundId: string,
): FirstEditionAccumulatingStunState {
  const state = normalizeFirstEditionAccumulatingStuns(current);
  if (!roundId || state.lastProcessedRoundId === roundId) return state;
  const roundsRemaining = Math.max(0, state.roundsRemaining - 1);
  return {
    ...state,
    penaltyDice: roundsRemaining > 0 ? state.penaltyDice : 0,
    roundsRemaining,
    lastProcessedRoundId: roundId,
  };
}
