import type {
  D6ActorConsequenceChannelStateV1,
  D6ActorConsequenceStateV1,
  D6ConsequencePenaltyEffectV1,
  D6ConsequencePenaltyProjectionV1,
} from "../contracts/consequences";

export const FREE_D6_FATIGUE_CHANNEL_ID = "free-d6.consequence.fatigue";

export interface FreeD6FatigueThresholdV1 {
  readonly basis: "stamina" | "willpower";
  readonly thresholdDice: number;
}

export interface FreeD6FatigueProjectionV1 {
  readonly effect: D6ConsequencePenaltyEffectV1;
  readonly level: number;
  readonly threshold: FreeD6FatigueThresholdV1;
  readonly unconscious: boolean;
}

function safeNonNegativeInteger(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

export function normalizeActorConsequenceState(
  value: unknown,
): D6ActorConsequenceStateV1 {
  const source =
    typeof value === "object" && value !== null
      ? (value as Readonly<Record<string, unknown>>)
      : {};
  const storedChannels =
    typeof source.channels === "object" && source.channels !== null
      ? (source.channels as Readonly<Record<string, unknown>>)
      : {};
  const channels: Record<string, D6ActorConsequenceChannelStateV1> = {};
  for (const [key, raw] of Object.entries(storedChannels)) {
    if (typeof raw !== "object" || raw === null) continue;
    const channel = raw as Readonly<Record<string, unknown>>;
    const channelId =
      typeof channel.channelId === "string" && channel.channelId.trim()
        ? channel.channelId
        : key;
    channels[channelId] = Object.freeze({
      channelId,
      level: safeNonNegativeInteger(channel.level),
      revision: safeNonNegativeInteger(channel.revision),
      source: typeof channel.source === "string" ? channel.source : "",
      unconscious: channel.unconscious === true,
    });
  }
  return Object.freeze({ channels: Object.freeze(channels), version: 1 });
}

export function freeD6FatigueThreshold(
  staminaScore: number,
  willpowerScore?: number,
): FreeD6FatigueThresholdV1 {
  const staminaDice = Math.floor(safeNonNegativeInteger(staminaScore) / 3);
  const willpowerDice = Math.max(
    0,
    Math.floor(safeNonNegativeInteger(willpowerScore) / 3) - 1,
  );
  return Object.freeze(
    willpowerScore !== undefined && willpowerDice > staminaDice
      ? { basis: "willpower", thresholdDice: willpowerDice }
      : { basis: "stamina", thresholdDice: staminaDice },
  );
}

export function freeD6FatigueProjection(
  level: number,
  staminaScore: number,
  willpowerScore?: number,
): FreeD6FatigueProjectionV1 {
  const normalizedLevel = safeNonNegativeInteger(level);
  const threshold = freeD6FatigueThreshold(staminaScore, willpowerScore);
  return Object.freeze({
    effect: Object.freeze({
      channelId: FREE_D6_FATIGUE_CHANNEL_ID,
      label: "Fatigue",
      penaltyScore: normalizedLevel * 3,
      scope: "all-rolls",
      stackingGroup: "consequences",
    }),
    level: normalizedLevel,
    threshold,
    unconscious: normalizedLevel > threshold.thresholdDice,
  });
}

export function applyFreeD6FatigueLevel(
  stateValue: unknown,
  level: number,
  staminaScore: number,
  options: {
    readonly expectedRevision?: number;
    readonly source?: string;
    readonly willpowerScore?: number;
  } = {},
): D6ActorConsequenceStateV1 {
  const state = normalizeActorConsequenceState(stateValue);
  const current = state.channels[FREE_D6_FATIGUE_CHANNEL_ID];
  const revision = current?.revision ?? 0;
  if (
    options.expectedRevision !== undefined &&
    options.expectedRevision !== revision
  ) {
    throw new Error("D6E2.Consequences.Error.RevisionConflict");
  }
  const projection = freeD6FatigueProjection(
    level,
    staminaScore,
    options.willpowerScore,
  );
  return Object.freeze({
    channels: Object.freeze({
      ...state.channels,
      [FREE_D6_FATIGUE_CHANNEL_ID]: Object.freeze({
        channelId: FREE_D6_FATIGUE_CHANNEL_ID,
        level: projection.level,
        revision: revision + 1,
        source: options.source ?? "",
        unconscious: projection.unconscious,
      }),
    }),
    version: 1,
  });
}

export function consequencePenaltyProjection(
  effects: readonly D6ConsequencePenaltyEffectV1[],
): D6ConsequencePenaltyProjectionV1 {
  const active = effects.filter(
    ({ penaltyScore, scope }) => scope === "all-rolls" && penaltyScore > 0,
  );
  return Object.freeze({
    effects: Object.freeze(
      active.map((effect) => Object.freeze({ ...effect })),
    ),
    totalPenaltyScore: active.reduce(
      (total, effect) => total + safeNonNegativeInteger(effect.penaltyScore),
      0,
    ),
  });
}
