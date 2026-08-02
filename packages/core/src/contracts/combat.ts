import type { SecondEditionMovementMode } from "../domain/combat";
import type { FirstEditionDefenseCommitment } from "../domain/action-economy";
import type {
  FirstEditionActiveDefenseKind,
  FirstEditionActiveDefenseMode,
} from "../domain/first-edition-combat";

export const D6_COMBAT_CONTRACT_VERSION = 2 as const;

export type D6CombatActionKind =
  "attribute" | "attack" | "move" | "other" | "skill";

export interface D6DeclaredCombatActionV1 {
  readonly baseScore?: number;
  readonly endProne?: boolean;
  readonly effectiveScore?: number;
  readonly id: string;
  readonly kind: D6CombatActionKind;
  readonly label: string;
  readonly movementMode?: SecondEditionMovementMode;
  readonly sourceId?: string;
}

export interface D6CombatantRoundStateV1 {
  readonly actionForfeiture?: D6CombatActionForfeitureV1;
  readonly actions: readonly D6DeclaredCombatActionV1[];
  readonly completedActionIds: readonly string[];
  readonly contractVersion: typeof D6_COMBAT_CONTRACT_VERSION;
  readonly firstEditionActiveDefense?: D6FirstEditionActiveDefenseV1;
  readonly firstEditionCommitment?: D6FirstEditionActionCommitmentV1;
  readonly secondEditionFullDefense?: D6SecondEditionFullDefenseV1;
  readonly secondEditionFeint?: D6SecondEditionFeintV1;
  readonly revision: number;
  readonly round: number;
}

export interface D6SecondEditionFullDefenseV1 {
  readonly acrobaticsBonus: number;
  readonly dodge: number;
  readonly meleeBonus: number;
  readonly parry: number;
  readonly sourcePage: 163;
}

export interface D6SecondEditionFeintV1 {
  readonly defensePenalty: number;
  readonly sourcePage: 162 | 163;
  readonly targetActorId: string;
  readonly targetName: string;
  readonly targetTokenId?: string;
}

export interface D6CombatActionForfeitureV1 {
  readonly reason: "wounded";
  readonly sourcePage: 33;
}

export interface D6FirstEditionActiveDefenseV1 {
  readonly difficulty: number;
  readonly kind: FirstEditionActiveDefenseKind;
  readonly label: string;
  readonly mode: FirstEditionActiveDefenseMode;
  readonly sourceId: string;
  readonly total: number;
}

export interface D6FirstEditionActionCommitmentV1 {
  readonly actionAllotment: number;
  readonly defense: FirstEditionDefenseCommitment;
  readonly plannedActionCount: number;
  readonly spentActionCount: number;
}

export interface D6CombatantRoundReadModelV1 extends D6CombatantRoundStateV1 {
  readonly active: boolean;
  readonly actorId: string;
  readonly combatantId: string;
  readonly complete: boolean;
  readonly currentAction?: D6DeclaredCombatActionV1;
  readonly currentSegment: number;
  readonly firstEditionActionPenaltyScore: number;
  readonly firstEditionCurrentSegment: number;
  readonly firstEditionNextCombatantId?: string;
  readonly firstEditionNextLabel?: string;
  readonly firstEditionRemainingActionCount: number;
  readonly firstEditionSegmentComplete: boolean;
  readonly firstEditionSegmentReady: boolean;
  readonly firstEditionSegmentWaitingLabels: readonly string[];
  readonly actionPenaltyScore: number;
  readonly movementSkillPenaltyScore: number;
  readonly penaltyScore: number;
  readonly penaltyLabel: string;
}

export interface D6FirstEditionActionDeclarationV1 {
  readonly actions?: readonly {
    readonly kind: D6CombatActionKind;
    readonly label: string;
    readonly sourceId?: string;
  }[];
  readonly actionAllotment: number;
  readonly defense: FirstEditionDefenseCommitment;
  readonly expectedRevision: number;
  readonly plannedActionCount: number;
  readonly spentActionCount: number;
}

export interface D6FirstEditionActiveDefenseResultV1 extends D6FirstEditionActiveDefenseV1 {
  readonly consumeAction: boolean;
  readonly expectedRevision: number;
}

export interface D6CombatDeclarationV1 {
  readonly actions: readonly {
    readonly sourceId?: string;
    readonly kind: D6CombatActionKind;
    readonly label: string;
    readonly endProne?: boolean;
    readonly movementMode?: SecondEditionMovementMode;
  }[];
  readonly expectedRevision: number;
}

export interface D6CombatCommandResultV1 {
  readonly changed: boolean;
  readonly state: D6CombatantRoundReadModelV1 | null;
}

export interface D6System2eCombatApi {
  completeNext(
    actor: object,
    expectedRevision: number,
  ): Promise<D6CombatCommandResultV1>;
  declare(
    actor: object,
    declaration: D6CombatDeclarationV1,
  ): Promise<D6CombatCommandResultV1>;
  commitFirstEdition(
    actor: object,
    declaration: D6FirstEditionActionDeclarationV1,
  ): Promise<D6CombatCommandResultV1>;
  recordFirstEditionDefense(
    actor: object,
    result: D6FirstEditionActiveDefenseResultV1,
  ): Promise<D6CombatCommandResultV1>;
  read(actor: object): D6CombatantRoundReadModelV1 | null;
  reset(
    actor: object,
    expectedRevision: number,
  ): Promise<D6CombatCommandResultV1>;
  fullDefense(
    actor: object,
    expectedRevision: number,
  ): Promise<D6CombatCommandResultV1>;
  feint(
    actor: object,
    targetTokenId: string,
    expectedRevision: number,
  ): Promise<D6CombatCommandResultV1>;
  spendFirstEdition(
    actor: object,
    expectedRevision: number,
  ): Promise<D6CombatCommandResultV1>;
}
