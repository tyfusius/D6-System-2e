import type { DifficultyEvaluation } from "../domain/check";
import type { DieCode } from "../domain/die-code";
import type { RulesProfileId } from "../domain/rules-profile";
import type { D6OpposedEvaluation, D6ParticipantKind } from "../domain/opposed";

export const D6_ROLL_CONTRACT_VERSION = 1 as const;

export type D6RollKind =
  "attribute" | "damage" | "resistance" | "skill" | "weapon-attack";
export type D6RollMode = "publicroll" | "gmroll" | "blindroll" | "selfroll";
export type D6WildDiePolicy = "second-edition" | "first-edition";
export type D6HeroPointUse = "none" | "double-die-code" | "reroll-failed";

export interface D6RollOpposition {
  readonly actorKind: D6ParticipantKind;
  readonly name: string;
  readonly opponentKind: D6ParticipantKind;
  readonly total: number;
  readonly wildDieFace?: number;
}

export type D6WildDieChoice =
  | "first-edition-remove-highest"
  | "first-edition-complication"
  | "second-edition-exceptional"
  | "second-edition-ordinary"
  | "second-edition-partial"
  | "second-edition-failure";

export type D6WildDieOutcome =
  | "normal"
  | "exploded"
  | "complication"
  | "exceptional-success"
  | "ordinary-success"
  | "partial-success"
  | "failure"
  | "unresolved-advantage"
  | "unresolved-complication";

export interface D6RollSource {
  readonly actorId: string;
  readonly actorName: string;
  readonly attributeId: string;
  readonly itemId?: string;
}

export interface D6RollRequestV1 {
  readonly contractVersion: typeof D6_ROLL_CONTRACT_VERSION;
  readonly difficulty?: number;
  readonly kind: D6RollKind;
  readonly label: string;
  readonly heroPointUse: D6HeroPointUse;
  readonly opposition?: D6RollOpposition;
  readonly resultModifier: number;
  readonly rollMode: D6RollMode;
  readonly score: number;
  readonly source: D6RollSource;
}

export interface D6RollPool {
  readonly baseDice: number;
  readonly code: DieCode;
  readonly resultModifier: number;
  readonly wildDice: 1;
}

export interface D6RollResultV1 {
  readonly baseFaces: readonly number[];
  readonly contractVersion: typeof D6_ROLL_CONTRACT_VERSION;
  readonly difficulty?: DifficultyEvaluation;
  readonly heroPointAward: 0 | 1 | 2;
  readonly heroPointSpent: 0 | 1;
  readonly opposition?: D6OpposedEvaluation;
  readonly pendingChoices: readonly D6WildDieChoice[];
  readonly pool: D6RollPool;
  readonly profileId: RulesProfileId;
  readonly request: D6RollRequestV1;
  readonly requiresWildExplosion: boolean;
  readonly success?: boolean;
  readonly total: number;
  readonly wildChoice?: D6WildDieChoice;
  readonly wildFaces: readonly number[];
  readonly wildOutcome: D6WildDieOutcome;
}

export interface D6System2eRollApi {
  attribute(actor: object, attributeId: string): Promise<D6RollResultV1 | null>;
  item(
    actor: object,
    itemId: string,
    mode?: "attack" | "damage",
  ): Promise<D6RollResultV1 | null>;
  reroll(
    actor: object,
    failedResult: D6RollResultV1,
  ): Promise<D6RollResultV1 | null>;
  skill(actor: object, itemId: string): Promise<D6RollResultV1 | null>;
}
