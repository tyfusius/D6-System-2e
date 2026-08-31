export const D6_FREE_D6_CREATION_CONTRACT_VERSION = 1 as const;

export type D6FreeD6CreationTransactionKind =
  | "advanced-skill"
  | "attribute"
  | "fate-point"
  | "flaw"
  | "merit"
  | "skill"
  | "specialization"
  | "template";

/** Creation Point values are stored in half-point units to avoid fractions. */
export interface D6FreeD6CreationTransactionV1 {
  readonly id: string;
  readonly kind: D6FreeD6CreationTransactionKind;
  readonly label: string;
  readonly pointUnits: number;
  readonly sourceId: string;
}

export interface D6FreeD6CreationDraftV1 {
  readonly baselineAttributeScores: Readonly<Record<string, number>>;
  readonly baselineSkillScores: Readonly<Record<string, number>>;
  readonly budgetUnits: number;
  readonly finalized: boolean;
  readonly revision: number;
  readonly strategyId: "free-d6.creation.creation-points";
  readonly templateId: string;
  readonly templatePointUnits: number;
  readonly transactions: readonly D6FreeD6CreationTransactionV1[];
  readonly version: typeof D6_FREE_D6_CREATION_CONTRACT_VERSION;
}

export interface D6FreeD6CreationLedgerV1 {
  readonly budgetUnits: number;
  readonly canFinalize: boolean;
  readonly characterPointSeedUnits: number;
  readonly creditUnits: number;
  readonly remainingUnits: number;
  readonly spentUnits: number;
  readonly templatePointUnits: number;
  readonly transactions: readonly D6FreeD6CreationTransactionV1[];
  readonly version: typeof D6_FREE_D6_CREATION_CONTRACT_VERSION;
}

export interface D6FreeD6TemplateExtensionV1 {
  readonly initialFatigueLevel?: number;
  readonly strategyId: "free-d6.creation.creation-points";
  readonly templatePointValue: number;
  readonly version: 1;
}
