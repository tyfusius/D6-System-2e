import type { D6RollResultV1 } from "./roll";

export const D6_FREEFORM_MAGIC_CONTRACT_VERSION = 1 as const;

export type D6FreeformMagicSchool =
  "alteration" | "apportation" | "conjuration" | "divination";

export type D6FreeformMagicResistance = "complete" | "none" | "partial";

export interface D6FreeformMagicDesignV1 {
  readonly castingTime:
    | "action"
    | "two-turns"
    | "four-turns"
    | "hour"
    | "day"
    | "week"
    | "month"
    | "year";
  readonly duration:
    | "instant"
    | "round"
    | "ten-minutes"
    | "hour"
    | "day"
    | "week"
    | "month"
    | "year"
    | "century"
    | "permanent";
  readonly power: number;
  readonly range:
    "melee" | "senses" | "mile" | "locale" | "hundred-miles" | "unlimited";
  readonly resistance: D6FreeformMagicResistance;
  readonly school: D6FreeformMagicSchool;
  readonly target:
    | "self"
    | "one"
    | "two-three"
    | "four-six"
    | "small-crowd"
    | "large-crowd"
    | "object"
    | "large-object"
    | "environment"
    | "large-environment";
}

export interface D6FreeformMagicDifficultyV1 {
  readonly base: 5;
  readonly castingTimeModifier: number;
  readonly contractVersion: typeof D6_FREEFORM_MAGIC_CONTRACT_VERSION;
  readonly difficulty: number;
  readonly durationModifier: number;
  readonly powerModifier: number;
  readonly rangeModifier: number;
  readonly resistanceModifier: number;
  readonly sourcePages: readonly [145, 159];
  readonly targetModifier: number;
}

export interface D6FreeformMagicCastResultV1 {
  readonly design: D6FreeformMagicDesignV1;
  readonly difficulty: D6FreeformMagicDifficultyV1;
  readonly manifestationId: string;
  readonly roll: D6RollResultV1;
  readonly schoolSpecializationId?: string;
  readonly untrainedPenalty: 0 | 5 | 10;
}

export interface D6System2eMagicApi {
  cast(
    actor: object,
    manifestationId: string,
  ): Promise<D6FreeformMagicCastResultV1 | null>;
  difficulty(design: D6FreeformMagicDesignV1): D6FreeformMagicDifficultyV1;
}
