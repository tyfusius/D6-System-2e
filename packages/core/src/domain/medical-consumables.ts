import type {
  D6DifficultyLadderEntryV2,
  D6DifficultyLadderSlot,
} from "../contracts/rules-profiles";
import type { FirstEditionWoundLevel } from "./combat";

export const MODEL_B_STIM_EFFECT_ID =
  "tyfusius.model-b-wound-penalty-suppression" as const;
export const MODEL_B_STIM_TIMING_POLICY_ID =
  "tyfusius.model-b.r-plus-n-campaign-5s" as const;
export const MODEL_B_STIM_SECONDS_PER_ROUND = 5 as const;

export type D6MedicalPhysiology = "biological" | "mechanical" | "unknown";
export type D6MedicalClockMode = "campaign" | "combat" | "unresolved";
export type D6MedicalTreatmentFamily = "open-d6-space" | "reup-medpac";

export interface D6ModelBStimClockV1 {
  readonly campaignHighWater: number | null;
  readonly combatRoundHighWater: number | null;
  readonly combatUuid: string | null;
  readonly mode: D6MedicalClockMode;
  readonly explicitCombatAnchor?: boolean;
  readonly unresolvedReason?:
    "ambiguous-combat" | "invalid-world-time" | "missing-combat";
}

export interface D6ModelBStimStateV1 {
  readonly version: 1;
  readonly useId: string;
  readonly rootMessageId: string;
  readonly effectId: typeof MODEL_B_STIM_EFFECT_ID;
  readonly timingPolicyId: typeof MODEL_B_STIM_TIMING_POLICY_ID;
  readonly durationRoll: number;
  readonly remainingSeconds: number;
  readonly clock: D6ModelBStimClockV1;
  readonly revision: number;
  readonly sourceActorUuid: string;
  readonly sourceItemUuid: string;
  readonly sourceItemName: string;
}

export interface D6ModelBStimProjectionV1 {
  readonly active: boolean;
  readonly applicable: boolean;
  readonly remainingSeconds: number;
  readonly state: D6ModelBStimStateV1;
  readonly suppressedPenaltyScore: number;
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function modelBStimInitialState(input: {
  readonly ambiguousCombat?: boolean;
  readonly campaignTime: number | null;
  readonly combatRound: number | null;
  readonly combatUuid: string | null;
  readonly durationRoll: number;
  readonly rootMessageId: string;
  readonly sourceActorUuid: string;
  readonly sourceItemName: string;
  readonly sourceItemUuid: string;
  readonly useId: string;
}): D6ModelBStimStateV1 {
  if (
    !Number.isSafeInteger(input.durationRoll) ||
    input.durationRoll < 1 ||
    input.durationRoll > 6 ||
    !input.useId ||
    !input.rootMessageId ||
    !input.sourceActorUuid ||
    !input.sourceItemUuid
  )
    throw new RangeError("Invalid Model B stim activation.");
  const inCombat =
    !!input.combatUuid &&
    input.combatRound !== null &&
    Number.isSafeInteger(input.combatRound) &&
    input.combatRound >= 1;
  const validCampaign =
    input.campaignTime !== null && finiteNonNegative(input.campaignTime);
  const clock: D6ModelBStimClockV1 = input.ambiguousCombat
    ? {
        campaignHighWater: validCampaign ? input.campaignTime : null,
        combatRoundHighWater: null,
        combatUuid: null,
        mode: "unresolved",
        unresolvedReason: "ambiguous-combat",
      }
    : inCombat
      ? {
          campaignHighWater: validCampaign ? input.campaignTime : null,
          combatRoundHighWater: input.combatRound,
          combatUuid: input.combatUuid,
          mode: "combat",
        }
      : validCampaign
        ? {
            campaignHighWater: input.campaignTime,
            combatRoundHighWater: null,
            combatUuid: null,
            mode: "campaign",
          }
        : {
            campaignHighWater: null,
            combatRoundHighWater: null,
            combatUuid: null,
            mode: "unresolved",
            unresolvedReason: "invalid-world-time",
          };
  return Object.freeze({
    version: 1,
    useId: input.useId,
    rootMessageId: input.rootMessageId,
    effectId: MODEL_B_STIM_EFFECT_ID,
    timingPolicyId: MODEL_B_STIM_TIMING_POLICY_ID,
    durationRoll: input.durationRoll,
    remainingSeconds: input.durationRoll * MODEL_B_STIM_SECONDS_PER_ROUND,
    clock: Object.freeze(clock),
    revision: 0,
    sourceActorUuid: input.sourceActorUuid,
    sourceItemUuid: input.sourceItemUuid,
    sourceItemName: input.sourceItemName,
  });
}

export function advanceModelBStimCampaignClock(
  state: D6ModelBStimStateV1,
  campaignTime: number,
): D6ModelBStimStateV1 {
  if (state.remainingSeconds <= 0 || state.clock.mode !== "campaign")
    return state;
  if (!finiteNonNegative(campaignTime))
    return unresolvedModelBStimClock(state, "invalid-world-time");
  const prior = state.clock.campaignHighWater;
  if (prior === null || campaignTime <= prior) return state;
  return Object.freeze({
    ...state,
    remainingSeconds: Math.max(
      0,
      state.remainingSeconds - (campaignTime - prior),
    ),
    clock: Object.freeze({ ...state.clock, campaignHighWater: campaignTime }),
    revision: state.revision + 1,
  });
}

export function advanceModelBStimCombatClock(
  state: D6ModelBStimStateV1,
  combatUuid: string,
  round: number,
): D6ModelBStimStateV1 {
  if (
    state.remainingSeconds <= 0 ||
    state.clock.mode !== "combat" ||
    state.clock.combatUuid !== combatUuid ||
    !Number.isSafeInteger(round) ||
    round < 1
  )
    return state;
  const prior = state.clock.combatRoundHighWater;
  if (prior === null || round <= prior) return state;
  return Object.freeze({
    ...state,
    remainingSeconds: Math.max(
      0,
      state.remainingSeconds - (round - prior) * MODEL_B_STIM_SECONDS_PER_ROUND,
    ),
    clock: Object.freeze({ ...state.clock, combatRoundHighWater: round }),
    revision: state.revision + 1,
  });
}

export function enterModelBStimCombat(
  state: D6ModelBStimStateV1,
  input: {
    readonly campaignTime: number;
    readonly combatUuid: string;
    readonly round: number;
  },
): D6ModelBStimStateV1 {
  if (state.clock.mode === "unresolved") return state;
  if (state.clock.mode === "combat")
    return state.clock.combatUuid === input.combatUuid
      ? advanceModelBStimCombatClock(state, input.combatUuid, input.round)
      : unresolvedModelBStimClock(state, "ambiguous-combat");
  const campaign = advanceModelBStimCampaignClock(state, input.campaignTime);
  if (
    campaign.remainingSeconds <= 0 ||
    !input.combatUuid ||
    !Number.isSafeInteger(input.round) ||
    input.round < 1
  )
    return campaign;
  return Object.freeze({
    ...campaign,
    clock: Object.freeze({
      campaignHighWater: finiteNonNegative(input.campaignTime)
        ? Math.max(
            campaign.clock.campaignHighWater ?? input.campaignTime,
            input.campaignTime,
          )
        : campaign.clock.campaignHighWater,
      combatRoundHighWater: input.round,
      combatUuid: input.combatUuid,
      mode: "combat" as const,
    }),
    revision: campaign.revision + 1,
  });
}

export function leaveModelBStimCombat(
  state: D6ModelBStimStateV1,
  input: {
    readonly campaignTime: number;
    readonly combatUuid: string;
    readonly round: number;
  },
): D6ModelBStimStateV1 {
  if (state.clock.mode === "unresolved") return state;
  if (
    state.clock.mode === "combat" &&
    state.clock.combatUuid !== input.combatUuid
  )
    return unresolvedModelBStimClock(state, "ambiguous-combat");
  const combat = advanceModelBStimCombatClock(
    state,
    input.combatUuid,
    input.round,
  );
  if (combat.remainingSeconds <= 0) return combat;
  if (!finiteNonNegative(input.campaignTime))
    return unresolvedModelBStimClock(combat, "invalid-world-time");
  return Object.freeze({
    ...combat,
    clock: Object.freeze({
      campaignHighWater: Math.max(
        combat.clock.campaignHighWater ?? input.campaignTime,
        input.campaignTime,
      ),
      combatRoundHighWater: combat.clock.combatRoundHighWater,
      combatUuid: null,
      mode: "campaign" as const,
    }),
    revision: combat.revision + 1,
  });
}

export function unresolvedModelBStimClock(
  state: D6ModelBStimStateV1,
  reason: NonNullable<D6ModelBStimClockV1["unresolvedReason"]>,
): D6ModelBStimStateV1 {
  if (
    state.clock.mode === "unresolved" &&
    state.clock.unresolvedReason === reason
  )
    return state;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Object rest intentionally drops the stale explicit combat anchor.
  const { explicitCombatAnchor: _explicitCombatAnchor, ...priorClock } =
    state.clock;
  return Object.freeze({
    ...state,
    clock: Object.freeze({
      ...priorClock,
      mode: "unresolved" as const,
      unresolvedReason: reason,
    }),
    revision: state.revision + 1,
  });
}

export function modelBStimProjection(
  state: D6ModelBStimStateV1,
  wound: FirstEditionWoundLevel,
  woundPenaltyScore: number,
  componentEnabled: boolean,
  supportedWoundModel = true,
): D6ModelBStimProjectionV1 {
  const active = state.remainingSeconds > 0;
  const applicable =
    active &&
    componentEnabled &&
    supportedWoundModel &&
    state.clock.mode !== "unresolved" &&
    (wound === "wounded" || wound === "severely-wounded");
  return Object.freeze({
    active,
    applicable,
    remainingSeconds: Math.max(0, state.remainingSeconds),
    state,
    suppressedPenaltyScore: applicable ? Math.max(0, woundPenaltyScore) : 0,
  });
}

export function modelBStimAdjustedConditionPenalty(input: {
  readonly woundPenaltyScore: number;
  readonly suppressedWoundPenaltyScore: number;
  readonly stunPenaltyScore: number;
}): number {
  const wound = Number.isFinite(input.woundPenaltyScore)
    ? Math.max(0, input.woundPenaltyScore)
    : 0;
  const suppression = Number.isFinite(input.suppressedWoundPenaltyScore)
    ? Math.max(0, input.suppressedWoundPenaltyScore)
    : 0;
  const stuns = Number.isFinite(input.stunPenaltyScore)
    ? Math.max(0, input.stunPenaltyScore)
    : 0;
  return Math.max(0, wound - suppression) + stuns;
}

const SPACE_CATEGORIES: Readonly<
  Record<FirstEditionWoundLevel, D6DifficultyLadderSlot>
> = Object.freeze({
  healthy: "easy",
  stunned: "easy",
  wounded: "moderate",
  "severely-wounded": "moderate",
  incapacitated: "difficult",
  "mortally-wounded": "very-difficult",
  dead: "heroic",
});
const REUP_CATEGORIES: Readonly<
  Record<FirstEditionWoundLevel, D6DifficultyLadderSlot>
> = Object.freeze({
  healthy: "very-easy",
  stunned: "very-easy",
  wounded: "easy",
  "severely-wounded": "easy",
  incapacitated: "moderate",
  "mortally-wounded": "difficult",
  dead: "heroic",
});
export interface D6MedicalTreatmentDifficultyV1 {
  readonly baseCategory: D6DifficultyLadderSlot;
  readonly baseValue: number;
  readonly finalCategory: string;
  readonly finalValue: number;
  readonly selfTreatment: boolean;
  readonly treatmentFamily: D6MedicalTreatmentFamily;
}

export function medicalTreatmentDifficulty(input: {
  readonly family: D6MedicalTreatmentFamily;
  readonly ladder: readonly D6DifficultyLadderEntryV2[];
  readonly printedBaseValue: number;
  readonly selfTreatment: boolean;
  readonly wound: FirstEditionWoundLevel;
}): D6MedicalTreatmentDifficultyV1 {
  const baseCategory = (
    input.family === "open-d6-space" ? SPACE_CATEGORIES : REUP_CATEGORIES
  )[input.wound];
  if (!Number.isFinite(input.printedBaseValue) || input.printedBaseValue < 0)
    throw new RangeError("Invalid printed medical treatment difficulty.");
  if (!input.selfTreatment)
    return Object.freeze({
      baseCategory,
      baseValue: input.printedBaseValue,
      finalCategory: baseCategory,
      finalValue: input.printedBaseValue,
      selfTreatment: false,
      treatmentFamily: input.family,
    });
  if (
    new Set(input.ladder.map(({ id }) => id)).size !== input.ladder.length ||
    input.ladder.some((entry, index) => {
      const previous = index > 0 ? input.ladder[index - 1] : undefined;
      return (
        !entry.id ||
        !Number.isSafeInteger(entry.value) ||
        entry.value < 0 ||
        (previous !== undefined && entry.value <= previous.value)
      );
    })
  )
    throw new RangeError(
      "Self-treatment difficulty category is unavailable or invalid.",
    );
  const index = input.ladder.findIndex(({ id }) => id === baseCategory);
  if (index < 0)
    throw new RangeError(
      "Self-treatment difficulty category is unavailable or invalid.",
    );
  const next = input.ladder[index + 1];
  if (!next)
    throw new RangeError(
      "Self-treatment has no strictly higher difficulty category.",
    );
  const finalCategory = next.id;
  const configured = next.value;
  if (
    !Number.isFinite(configured) ||
    !Number.isSafeInteger(configured) ||
    configured < 0
  )
    throw new RangeError(
      "Self-treatment difficulty category is unavailable or invalid.",
    );
  if (configured <= input.printedBaseValue)
    throw new RangeError(
      "Self-treatment difficulty category is unavailable or invalid.",
    );
  const finalValue = configured;
  return Object.freeze({
    baseCategory,
    baseValue: input.printedBaseValue,
    finalCategory,
    finalValue,
    selfTreatment: true,
    treatmentFamily: input.family,
  });
}
