import type { D6RollResultV1 } from "./roll";

export const D6_FREEFORM_MAGIC_CONTRACT_VERSION = 1 as const;
export const D6_FIRST_EDITION_FANTASY_MAGIC_CONTRACT_VERSION = 1 as const;
export const D6_FIRST_EDITION_ADVENTURE_MAGIC_CONTRACT_VERSION = 1 as const;
export const D6_MAGIC_POINTS_CONTRACT_VERSION = 1 as const;

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

export type D6FirstEditionFantasyMagicTradition = "magic" | "miracles";

export interface D6FirstEditionFantasyMagicDesignV1 {
  readonly difficulty: number;
  readonly skillKey: string;
  readonly sourcePage: number;
  readonly tradition: D6FirstEditionFantasyMagicTradition;
}

export interface D6FirstEditionFantasyMagicCastResultV1 {
  readonly contractVersion: typeof D6_FIRST_EDITION_FANTASY_MAGIC_CONTRACT_VERSION;
  readonly design: D6FirstEditionFantasyMagicDesignV1;
  readonly manifestationId: string;
  readonly roll: D6RollResultV1;
  readonly strategy: "first-edition-fantasy";
  readonly untrainedPenalty: 0 | 5;
}

export type D6FirstEditionAdventureMagicTradition = "magic" | "psionics";

export interface D6FirstEditionAdventureMagicDesignV1 {
  readonly difficulty: number;
  readonly skillKey: string;
  readonly sourcePage: number;
  readonly tradition: D6FirstEditionAdventureMagicTradition;
}

export interface D6FirstEditionAdventureMagicCastResultV1 {
  readonly contractVersion: typeof D6_FIRST_EDITION_ADVENTURE_MAGIC_CONTRACT_VERSION;
  readonly design: D6FirstEditionAdventureMagicDesignV1;
  readonly manifestationId: string;
  readonly roll: D6RollResultV1;
  readonly strategy: "first-edition-adventure";
  readonly untrainedPenalty: 0 | 5;
}

export interface D6MagicPointPoolV1 {
  readonly contractVersion: typeof D6_MAGIC_POINTS_CONTRACT_VERSION;
  readonly current: number;
  readonly magicDice: number;
  readonly maximum: number;
  readonly mysticalAlignmentDice: number;
}

export interface D6MagicPointCastResultV1 {
  readonly cost: number;
  readonly design: D6FreeformMagicDesignV1;
  readonly difficulty: D6FreeformMagicDifficultyV1;
  readonly manifestationId: string;
  readonly pool: D6MagicPointPoolV1;
  readonly sourcePages: readonly [160, 162];
  readonly strategy: "magic-points";
}

export type D6MagicCastResultV1 =
  | D6FirstEditionAdventureMagicCastResultV1
  | D6FirstEditionFantasyMagicCastResultV1
  | D6FreeformMagicCastResultV1
  | D6MagicPointCastResultV1;

export interface D6System2eMagicApi {
  cast(
    actor: object,
    manifestationId: string,
  ): Promise<D6MagicCastResultV1 | null>;
  difficulty(design: D6FreeformMagicDesignV1): D6FreeformMagicDifficultyV1;
  recover(actor: object, hours?: number): Promise<D6MagicPointPoolV1>;
  resource(actor: object): D6MagicPointPoolV1;
}
