import type { SecondEditionMovementMode } from "../domain/combat";

export const D6_COMBAT_CONTRACT_VERSION = 1 as const;

export type D6CombatActionKind =
  "attribute" | "attack" | "move" | "other" | "skill";

export interface D6DeclaredCombatActionV1 {
  readonly endProne?: boolean;
  readonly id: string;
  readonly kind: D6CombatActionKind;
  readonly label: string;
  readonly movementMode?: SecondEditionMovementMode;
}

export interface D6CombatantRoundStateV1 {
  readonly actions: readonly D6DeclaredCombatActionV1[];
  readonly completedActionIds: readonly string[];
  readonly contractVersion: typeof D6_COMBAT_CONTRACT_VERSION;
  readonly revision: number;
  readonly round: number;
}

export interface D6CombatantRoundReadModelV1 extends D6CombatantRoundStateV1 {
  readonly active: boolean;
  readonly actorId: string;
  readonly combatantId: string;
  readonly complete: boolean;
  readonly currentAction?: D6DeclaredCombatActionV1;
  readonly currentSegment: number;
  readonly penaltyScore: number;
  readonly penaltyLabel: string;
}

export interface D6CombatDeclarationV1 {
  readonly actions: readonly {
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
  read(actor: object): D6CombatantRoundReadModelV1 | null;
  reset(
    actor: object,
    expectedRevision: number,
  ): Promise<D6CombatCommandResultV1>;
}
