import type { DieCode } from "../domain/die-code";
import type { RulesProfileId } from "../domain/rules-profile";
import type { SecondEditionCondition } from "../domain/combat";
import type { FirstEditionWoundLevel } from "../domain/combat";
import type { FirstEditionDamageMode } from "../domain/first-edition-body-points";
import type { EditionCapabilityState } from "../domain/edition-capabilities";
import type { FirstEditionAccumulatingStunState } from "../domain/first-edition-accumulating-stuns";
import type { D6FeatureMechanicV1 } from "./feature-catalogs";

export const D6_ACTOR_READ_MODEL_VERSION = 1 as const;

export interface D6ActorAttributeReadModelV1 {
  readonly code: DieCode;
  readonly id: string;
  readonly label: string;
  readonly rollable: boolean;
  readonly score: number;
}

export interface D6ActorSkillReadModelV1 {
  readonly attributeId: string;
  readonly bonusScore: number;
  readonly code: DieCode;
  readonly id: string;
  readonly kind: "advanced" | "specialization" | "standard";
  readonly label: string;
  readonly parentSkillId?: string;
  readonly rollable: boolean;
  readonly score: number;
}

export type D6ActorRollableItemMode = "attack" | "damage";

export interface D6ActorRollableItemReadModelV1 {
  readonly damageCode: DieCode;
  readonly equipped: boolean;
  readonly id: string;
  readonly image: string;
  readonly modes: readonly D6ActorRollableItemMode[];
  readonly name: string;
  readonly type: "starship-weapon" | "vehicle-weapon" | "weapon";
}

export interface D6MachineReadModelV1 {
  readonly capacity: {
    readonly kind: "minimum-crew" | "passengers";
    readonly value: number;
  };
  readonly condition: SecondEditionCondition;
  readonly crew: {
    readonly assigned: number;
    readonly missing: number;
  };
  readonly defense: number;
  readonly kind: "starship" | "vehicle";
  readonly protectionScore: number;
  readonly resistanceScore: number;
}

export type D6ActorFeatureType =
  "asset" | "flaw" | "perk" | "talent" | "trouble";

export interface D6ActorFeatureReadModelV1 {
  readonly catalogId: string;
  readonly capabilityState: EditionCapabilityState;
  readonly cost: number;
  readonly creationSkillCostScore: number;
  readonly focus: string;
  readonly id: string;
  readonly image: string;
  readonly definitionId: string;
  readonly mechanics: readonly D6FeatureMechanicV1[];
  readonly name: string;
  readonly ownerId: string;
  readonly rank: number;
  readonly repeatable: boolean;
  readonly sessionMaximum: 0 | 2;
  readonly sessionUses: number;
  readonly trigger: string;
  readonly type: D6ActorFeatureType;
}

export interface D6ActorReadModelV1 {
  readonly attributes: readonly D6ActorAttributeReadModelV1[];
  readonly contractVersion: typeof D6_ACTOR_READ_MODEL_VERSION;
  readonly id: string;
  readonly features: readonly D6ActorFeatureReadModelV1[];
  readonly image: string;
  readonly health: {
    readonly bodyPoints: {
      readonly current: number;
      readonly maximum: number;
    };
    readonly condition: SecondEditionCondition;
    readonly firstEditionMode: FirstEditionDamageMode;
    readonly firstEditionStuns: FirstEditionAccumulatingStunState;
    readonly firstEditionStunsActive: boolean;
    readonly firstEditionWound: FirstEditionWoundLevel;
  };
  readonly items: readonly D6ActorRollableItemReadModelV1[];
  readonly name: string;
  readonly machine?: D6MachineReadModelV1;
  readonly permissions: {
    readonly canEdit: boolean;
    readonly isOwner: boolean;
  };
  readonly resources: {
    readonly characterPoints: number;
    readonly experiencePoints: number;
    readonly fatePoints: number;
    readonly heroPoints: number;
    readonly magicPoints: number;
  };
  readonly rulesProfileId: RulesProfileId;
  readonly skills: readonly D6ActorSkillReadModelV1[];
  readonly type: string;
}

export interface D6System2eReadApi {
  actor(actor: object): D6ActorReadModelV1;
}
