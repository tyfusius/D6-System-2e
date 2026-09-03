import type {
  D6FeatureMechanicApplication,
  D6FeatureMechanicV1,
} from "./feature-catalogs";

export const D6_DISTINCTION_AUTOMATION_VERSION = 1 as const;

export type D6DistinctionMechanicDisposition =
  "automatic" | "declaration" | "narrative-only" | "stored-only";

/** Native Item snapshot consumed by the derived Distinction resolver. */
export interface D6DistinctionSourceV1 {
  readonly definitionId: string;
  readonly itemId: string;
  readonly label: string;
  readonly mechanics: readonly D6FeatureMechanicV1[];
  readonly private: boolean;
  readonly rank: number;
}

export interface D6DistinctionRollScopeV1 {
  readonly applications: readonly D6FeatureMechanicApplication[];
  readonly attributeId?: string;
  readonly itemId?: string;
  readonly kind:
    "attribute" | "damage" | "resistance" | "skill" | "weapon-attack";
}

export interface D6DistinctionRollEffectV1 {
  readonly application: D6FeatureMechanicApplication;
  readonly definitionId: string;
  readonly effectId: string;
  readonly itemId: string;
  readonly label: string;
  readonly mode: "automatic" | "chosen";
  readonly private: boolean;
  readonly score: number;
}

/** A contextual modifier offered to the roller without mutating its source Item. */
export type D6DistinctionRollChoiceV1 = Omit<D6DistinctionRollEffectV1, "mode">;

export interface D6DistinctionInertMechanicV1 {
  readonly definitionId: string;
  readonly disposition: Exclude<D6DistinctionMechanicDisposition, "automatic">;
  readonly effectId: string;
  readonly itemId: string;
  readonly kind: D6FeatureMechanicV1["kind"];
}

export interface D6DistinctionRollEvaluationV1 {
  readonly choices: readonly D6DistinctionRollChoiceV1[];
  readonly effects: readonly D6DistinctionRollEffectV1[];
  readonly inert: readonly D6DistinctionInertMechanicV1[];
  readonly totalScore: number;
  readonly version: typeof D6_DISTINCTION_AUTOMATION_VERSION;
}
