import type { DieCode } from "../domain/die-code";
import type { RulesProfileId } from "../domain/rules-profile";

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

export interface D6ActorReadModelV1 {
  readonly attributes: readonly D6ActorAttributeReadModelV1[];
  readonly contractVersion: typeof D6_ACTOR_READ_MODEL_VERSION;
  readonly id: string;
  readonly image: string;
  readonly name: string;
  readonly permissions: {
    readonly canEdit: boolean;
    readonly isOwner: boolean;
  };
  readonly resources: {
    readonly characterPoints: number;
    readonly fatePoints: number;
    readonly heroPoints: number;
  };
  readonly rulesProfileId: RulesProfileId;
  readonly skills: readonly D6ActorSkillReadModelV1[];
  readonly type: string;
}

export interface D6System2eReadApi {
  actor(actor: object): D6ActorReadModelV1;
}
