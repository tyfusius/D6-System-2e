export const D6_MATCHING_EVALUATOR_VERSION = 1 as const;
export const D6_MATCHING_ROLL_CONTRACT_VERSION = 3 as const;
export const D6_MATCHING_REWARD_POLICY_VERSION = 1 as const;
export const D6_MATCHING_REWARD_MAX = 999 as const;

export type D6MatchingEvaluationMode =
  "best-combination" | "minimum-combination";
export type D6MatchingRollKind = "attribute" | "skill";

export interface D6MatchingGroupRequirementV1 {
  readonly count: number;
  readonly mode: "exact" | "minimum";
}

export interface D6MatchingPatternV1 {
  readonly enabled: boolean;
  readonly groups: readonly D6MatchingGroupRequirementV1[];
  readonly id: string;
  readonly label: string;
  readonly precedence: number;
}

export interface D6MatchingEvaluatorV1 {
  readonly appliesTo: readonly D6MatchingRollKind[];
  readonly capabilities: Readonly<{
    readonly characterPoints: false;
    readonly fatePoints: false;
    readonly heroPoints: false;
    readonly pips: false;
    readonly resultModifiers: false;
    readonly retries: false;
    readonly specialDie: "none";
  }>;
  readonly fallbackPatternId: string;
  readonly id: string;
  readonly label: string;
  readonly patterns: readonly D6MatchingPatternV1[];
  readonly pool: Readonly<{
    readonly maximum: number;
    readonly minimum: number;
  }>;
  readonly source:
    | Readonly<{ readonly kind: "system" }>
    | Readonly<{ readonly kind: "world" }>
    | Readonly<{ readonly kind: "module"; readonly ownerId: string }>;
  readonly version: typeof D6_MATCHING_EVALUATOR_VERSION;
}

export interface D6MatchingFaceGroupV1 {
  readonly count: number;
  readonly dieIndices: readonly number[];
  readonly face: number;
}

export interface D6MatchingConsumedGroupV1 extends D6MatchingFaceGroupV1 {
  readonly requiredCount: number;
  readonly requirementMode: "exact" | "minimum";
}

export interface D6MatchingCandidateV1 {
  readonly consumedGroups: readonly D6MatchingConsumedGroupV1[];
  readonly patternId: string;
  readonly patternLabel: string;
  readonly precedence: number;
  readonly rankVector: readonly number[];
  readonly unusedDieIndices: readonly number[];
  readonly unusedFaces: readonly number[];
}

export interface D6MatchingEvaluatorSnapshotV1 {
  readonly evaluator: D6MatchingEvaluatorV1;
  readonly hash: string;
  readonly version: typeof D6_MATCHING_EVALUATOR_VERSION;
}

export interface D6MatchingResultV1 {
  readonly best: D6MatchingCandidateV1;
  readonly candidates: readonly D6MatchingCandidateV1[];
  readonly contractVersion: typeof D6_MATCHING_ROLL_CONTRACT_VERSION;
  readonly evaluator: D6MatchingEvaluatorSnapshotV1;
  readonly groups: readonly D6MatchingFaceGroupV1[];
  readonly mode: D6MatchingEvaluationMode;
  readonly rawFaces: readonly number[];
  readonly kind: "matching-observation";
  readonly success?: boolean;
  readonly targetPatternId?: string;
  /** Immutable post-roll audit evidence. Absent when no reward was configured. */
  readonly reward?: D6MatchingRewardSnapshotV1;
}

export interface D6MatchingPatternRewardV1 {
  readonly characterPoints: number;
  readonly enabled: boolean;
  /** Last-known presentation only; mechanics remain keyed by stable IDs. */
  readonly patternLabel: string;
  readonly sourceLabel: string;
  readonly metaCurrency: number;
}

export interface D6MatchingRewardPolicyV1 {
  readonly awards: Readonly<Record<string, D6MatchingPatternRewardV1>>;
  readonly enabled: boolean;
  readonly evaluatorId: string;
  readonly detectorId: string;
  readonly version: typeof D6_MATCHING_REWARD_POLICY_VERSION;
}

export interface D6MatchingRewardPlanV1 {
  readonly characterPoints: number;
  readonly evaluatorId: string;
  readonly metaCurrency: number;
  readonly operationId: string;
  readonly patternId: string;
  readonly patternLabel: string;
  readonly detectorId: string;
  readonly version: typeof D6_MATCHING_REWARD_POLICY_VERSION;
}

export interface D6MatchingRewardSnapshotV1 extends D6MatchingRewardPlanV1 {
  readonly metaCurrencyResource:
    "experiencePoints" | "fatePoints" | "heroPoints" | "nemesisPoints";
  readonly status: "failed" | "granted";
}

export interface D6MatchingEvaluationOptionsV1 {
  readonly mode: D6MatchingEvaluationMode;
  readonly targetPatternId?: string;
}

export interface D6MatchingEvaluatorContributionV1 {
  readonly evaluator: D6MatchingEvaluatorV1;
  readonly id: string;
  readonly label: string;
  readonly version: 1;
}

export interface D6System2eMatchingEvaluatorRegistry {
  current(): readonly D6MatchingEvaluatorContributionV1[];
  register(
    ownerId: string,
    contribution: D6MatchingEvaluatorContributionV1,
  ): void;
  unregisterOwner(ownerId: string): void;
}
