import type { DifficultyEvaluation } from "../domain/check";
import type { DieCode } from "../domain/die-code";
import type { RulesProfileId } from "../domain/rules-profile";
import type { D6OpposedEvaluation, D6ParticipantKind } from "../domain/opposed";
import type {
  SecondEditionAttackKind,
  SecondEditionDefenseKind,
  SecondEditionRangeBand,
} from "../domain/combat";
import type { ActionPenaltySource } from "../domain/action-economy";
import type {
  FirstEditionActiveDefenseKind,
  FirstEditionActiveDefenseMode,
  FirstEditionMovementType,
} from "../domain/first-edition-combat";
import type {
  D6EnvironmentHazard,
  D6EnvironmentSeverity,
} from "../domain/environment";
import type { D6FreeformMagicSchool } from "./magic";
import type { SuperheroicDieCodeCap } from "../domain/superheroic";

export const D6_ROLL_CONTRACT_VERSION = 2 as const;

export type D6RollKind =
  "attribute" | "damage" | "resistance" | "skill" | "weapon-attack";
export type D6RollMode = "publicroll" | "gmroll" | "blindroll" | "selfroll";
export type D6RequestedRollVisibility = "hidden" | "private" | "public";
export type D6WildDiePolicy =
  | "second-edition"
  | "second-edition-basic"
  | "second-edition-classic"
  | "second-edition-simple"
  | "first-edition";
export type D6HeroPointUse =
  | "none"
  | "double-die-code"
  | "reroll-failed"
  | "basic-bonus-dice"
  | "classic-bonus-wild-dice"
  | "superheroic-bypass-cap";

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
  | "second-edition-classic-penalty"
  | "second-edition-classic-complication"
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
  | "penalty"
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

export interface D6AdvancedSkillRollContext {
  readonly itemId: string;
  readonly label: string;
  readonly score: number;
}

export interface D6ActionEconomyRollContext {
  readonly actionCount?: number;
  readonly actionPenaltyScore?: number;
  readonly condition?: string;
  readonly conditionPenaltyScore?: number;
  readonly environmentPenaltyScore?: number;
  readonly mapPenaltyScore?: number;
  readonly mapPenaltySource?: ActionPenaltySource;
  readonly movementSkillPenaltyScore?: number;
  readonly penaltyLabel: string;
  readonly penaltyScore: number;
  readonly round?: number;
  readonly trackedPenaltyScore?: number;
}

export interface D6DoublingDownRollContext {
  readonly narration?: string;
  readonly originalTotal: number;
  readonly sourcePage: 25;
}

export interface D6EnvironmentRollContext {
  readonly action: "affected-roll" | "exposure" | "recovery";
  readonly difficulty: 15 | 20 | 30;
  readonly failureCondition: string;
  readonly halfMove: boolean;
  readonly hazard: D6EnvironmentHazard;
  readonly penaltyScore: 0 | 3 | 6;
  readonly severity: D6EnvironmentSeverity;
  readonly sourcePage: 77 | 78;
  readonly targetActorId: string;
  readonly targetName: string;
}

export interface D6FirstEditionActiveDefenseRollContext {
  readonly kind: FirstEditionActiveDefenseKind;
  readonly mode: FirstEditionActiveDefenseMode;
  readonly resultModifier: number;
  readonly sourcePage: 73;
}

export interface D6FirstEditionMovementRollContext {
  readonly difficulty: number;
  readonly distance: number;
  readonly sourcePage: 63 | 64;
  readonly type: FirstEditionMovementType;
}

export interface D6WeaponAttackRollContext {
  readonly attackKind: SecondEditionAttackKind;
  readonly baseDefense: number;
  readonly coverModifier: number;
  readonly coverSourcePage: 30;
  readonly defense: number;
  readonly defenseKind: SecondEditionDefenseKind;
  readonly defenseSourcePage?: 33 | 94 | 111 | 180 | 183;
  readonly defenseStrategy?:
    | "fixed-range"
    | "grenade-targeting"
    | "machine-defense"
    | "static-dodge"
    | "static-parry";
  readonly feintPenalty?: number;
  readonly distance?: number;
  readonly rangeBand?: SecondEditionRangeBand;
  readonly targetActorId: string;
  readonly targetDodging?: boolean;
  readonly targetName: string;
  readonly targetTokenId?: string;
  readonly weaponId: string;
}

export interface D6SecondEditionAutofireRollContext {
  readonly attackModifier: number;
  readonly damageModifier: number;
  readonly maximum: number;
  readonly sourcePage: 163;
  readonly spend: number;
}

export interface D6ResistanceRollContext {
  readonly armorContributors: readonly {
    readonly itemId: string;
    readonly label: string;
    readonly score: number;
  }[];
  readonly armorScore: number;
  readonly baseLabel: string;
  readonly brawnScore: number;
  readonly capped?: boolean;
  readonly kind: "machine" | "personal";
  readonly machineKind?: "starship" | "vehicle";
  readonly maximumScore?: number;
  readonly maximumSourcePage?: 90;
  readonly protectionLabel: string;
  readonly sourcePage: 34 | 76 | 180 | 183;
  readonly strategy:
    | "open-d6-wound-levels"
    | "open-d6-body-points"
    | "second-edition-conditions"
    | "second-edition-machine-conditions";
  readonly uncappedScore?: number;
}

export interface D6MachineCrewRollContext {
  readonly assignedCrewCount: number;
  readonly crewActorId: string;
  readonly crewName: string;
  readonly crewPenaltyScore: number;
  readonly crewSkillItemId: string;
  readonly crewSkillScore: number;
  readonly machineActorId: string;
  readonly machineKind: "starship" | "vehicle";
  readonly machineName: string;
  readonly minimumCrew: number;
  readonly missingCrewCount: number;
  readonly sourcePage: 177 | 180 | 182;
  readonly weaponAttackBonusScore: number;
}

export type D6ScaleRollApplication = "attack" | "damage" | "resistance";

export interface D6ScaleRollContext {
  readonly application: D6ScaleRollApplication;
  readonly modifierScore: number;
  readonly sourcePage: 196;
  readonly sourceActorId: string;
  readonly sourceName: string;
  readonly sourceRank: number;
  readonly sourceTokenId?: string;
  readonly targetActorId: string;
  readonly targetName: string;
  readonly targetRank: number;
  readonly targetTokenId?: string;
}

export interface D6RequestedRollContextV1 {
  readonly recipientUserId: string;
  readonly requestId: string;
  readonly requesterName: string;
  readonly requesterUserId: string;
  readonly rollMode: Exclude<D6RollMode, "selfroll">;
  readonly visibility: D6RequestedRollVisibility;
}

export interface D6RollContextV1 {
  readonly superheroicDieCodeCap?: {
    readonly cap: SuperheroicDieCodeCap;
    readonly sourcePage: 208;
  };
  readonly cyberpunk?: {
    readonly action: "hack" | "install";
    readonly sourcePage: 192 | 195;
    readonly targetLabel: string;
  };
  readonly autofire?: D6SecondEditionAutofireRollContext;
  readonly actionEconomy?: D6ActionEconomyRollContext;
  readonly advancedSkill?: D6AdvancedSkillRollContext;
  readonly doublingDown?: D6DoublingDownRollContext;
  readonly environment?: D6EnvironmentRollContext;
  readonly featureBonus?: {
    readonly itemId: string;
    readonly score: 9;
  };
  readonly superheroicEquipment?: {
    readonly bonusScore: 3;
    readonly itemId: string;
    readonly itemName: string;
    readonly sourcePage: 227;
    readonly useCase: string;
  };
  readonly firstEditionActiveDefense?: D6FirstEditionActiveDefenseRollContext;
  readonly firstEditionMovement?: D6FirstEditionMovementRollContext;
  readonly firstEditionMortality?: {
    readonly checkId: string;
    readonly completedRounds: number;
    readonly elapsedMinutes: number;
    readonly sourcePage: 76;
  };
  readonly machineCrew?: D6MachineCrewRollContext;
  readonly magic?:
    | {
        readonly castingTime: string;
        readonly duration: string;
        readonly manifestationId: string;
        readonly power: number;
        readonly range: string;
        readonly resistance: string;
        readonly school: D6FreeformMagicSchool;
        readonly sourcePages: readonly [145, 159];
        readonly target: string;
        readonly untrainedPenalty: 0 | 5 | 10;
      }
    | {
        readonly difficulty: number;
        readonly manifestationId: string;
        readonly skillKey: string;
        readonly sourceBook: "D6 Fantasy";
        readonly sourcePage: number;
        readonly strategy: "first-edition-fantasy";
        readonly tradition: "magic" | "miracles";
        readonly untrainedPenalty: 0 | 5;
      };
  readonly psionics?: {
    readonly baseDifficulty: number;
    readonly difficultyModifier: number;
    readonly disciplines: readonly ("kinesis" | "perceive" | "reform")[];
    readonly powerId: string;
    readonly recentAttempts: number;
    readonly scalingDifficulty: number;
    readonly sourceBook: string;
    readonly sourcePage: number;
  };
  readonly resistance?: D6ResistanceRollContext;
  readonly requestedRoll?: D6RequestedRollContextV1;
  readonly scale?: D6ScaleRollContext;
  readonly weaponAttack?: D6WeaponAttackRollContext;
}

export interface D6RollInvocationOptionsV1 {
  readonly advancedSkillItemId?: string;
  readonly featureBonus?: {
    readonly itemId: string;
    readonly score: 9;
  };
  readonly gadgetBonus?: {
    readonly itemId: string;
  };
  readonly requestedRoll?: D6RequestedRollContextV1;
}

export interface D6RollRequestV2 {
  readonly contractVersion: typeof D6_ROLL_CONTRACT_VERSION;
  readonly context?: D6RollContextV1;
  readonly difficulty?: number;
  readonly kind: D6RollKind;
  readonly label: string;
  readonly heroPointUse: D6HeroPointUse;
  readonly heroPointSpend?: number;
  readonly opposition?: D6RollOpposition;
  readonly resultModifier: number;
  readonly rollMode: D6RollMode;
  readonly score: number;
  readonly source: D6RollSource;
}

export interface D6RollPool {
  readonly baseDice: number;
  readonly bonusOrdinaryDice: number;
  readonly bonusWildDice: number;
  readonly code: DieCode;
  readonly resultModifier: number;
  readonly wildDice: number;
}

export interface D6RollResultV2 {
  readonly baseFaces: readonly number[];
  readonly contractVersion: typeof D6_ROLL_CONTRACT_VERSION;
  readonly difficulty?: DifficultyEvaluation;
  readonly heroPointAward: number;
  readonly heroPointSpent: number;
  readonly opposition?: D6OpposedEvaluation;
  readonly pendingChoices: readonly D6WildDieChoice[];
  readonly pool: D6RollPool;
  readonly profileId: RulesProfileId;
  readonly request: D6RollRequestV2;
  readonly requiresWildExplosion: boolean;
  readonly success?: boolean;
  readonly total: number;
  readonly wildChoice?: D6WildDieChoice;
  readonly wildFaces: readonly number[];
  readonly wildFaceGroups?: readonly (readonly number[])[];
  readonly wildPolicy: D6WildDiePolicy;
  readonly wildOutcome: D6WildDieOutcome;
}

/** Compatibility source alias retained for existing integrations. */
export type D6RollRequestV1 = D6RollRequestV2;
/** Compatibility source alias retained for existing integrations. */
export type D6RollResultV1 = D6RollResultV2;

export interface D6System2eRollApi {
  attribute(
    actor: object,
    attributeId: string,
    options?: D6RollInvocationOptionsV1,
  ): Promise<D6RollResultV1 | null>;
  doubleDown(
    actor: object,
    failedResult: D6RollResultV1,
    narration?: string,
  ): Promise<D6RollResultV1 | null>;
  defense(
    actor: object,
    kind: FirstEditionActiveDefenseKind,
  ): Promise<D6RollResultV1 | null>;
  item(
    actor: object,
    itemId: string,
    mode?: "attack" | "damage",
  ): Promise<D6RollResultV1 | null>;
  resistance(actor: object): Promise<D6RollResultV1 | null>;
  reroll(
    actor: object,
    failedResult: D6RollResultV1,
  ): Promise<D6RollResultV1 | null>;
  skill(
    actor: object,
    itemId: string,
    options?: D6RollInvocationOptionsV1,
  ): Promise<D6RollResultV1 | null>;
}
