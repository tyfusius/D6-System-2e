import type { D6ExtraordinaryPowerRollPlanV1 } from "./extraordinary-powers";
import type { D6RollRequestV1, D6RollResultV1 } from "./roll";
/** Optional shared-session homebrew; never an Actor resource or scene Token. */
export const D6_DESTINY_VERSION = 1 as const;
export const D6_DESTINY_MAX_COINS = 3 as const;
export type D6DestinyFace = "light" | "dark";
export type D6DestinyEffectKind =
  "difficulty" | "incoming-hit" | "talent" | "complication";

export interface D6DestinyConfigurationV1 {
  readonly version: 1;
  readonly enabled: boolean;
  readonly size: 1 | 2 | 3;
}

export interface D6DestinyCoinV1 {
  readonly id: string;
  readonly face: D6DestinyFace;
  readonly reservationId?: string;
}

/** Only these GM-reviewed fields may produce an equipment document. */
export type D6DestinyDeliveryV1 =
  | { readonly kind: "fact"; readonly fact: string }
  | {
      readonly kind: "equipment";
      readonly actorId: string;
      readonly itemId: string;
      readonly sourceUuid?: string;
      readonly sourceDigest?: string;
      readonly name: string;
      readonly description: string;
      readonly quantity: number;
      readonly charges: number;
      readonly permanence: "session" | "permanent";
    };

export interface D6DestinyProposalV1 {
  readonly id: string;
  readonly userId: string;
  readonly actorId: string;
  readonly coinId: string;
  readonly story: string;
  readonly situation: string;
  readonly request: string;
  readonly equipmentRequested?: boolean;
  readonly status:
    | "pending"
    | "revision"
    | "rejected"
    | "cancelled"
    | "delivering"
    | "approved";
  readonly review: string;
  readonly delivery?: D6DestinyDeliveryV1;
  readonly itemFingerprint?: string;
  readonly cleanup?: "removed" | "retained" | "missing";
}

export interface D6DestinyEffectV1 {
  readonly id: string;
  /** Immutable identity of the roll, hit or activation; both sides share it. */
  readonly key: string;
  readonly kind: D6DestinyEffectKind;
  readonly actorId: string;
  readonly userId: string;
  readonly label: string;
  readonly side: D6DestinyFace | "either";
  readonly lightDirection?: "lower" | "raise";
  readonly public?: boolean;
  readonly narrative?: string;
  readonly situation?: string;
  readonly status: "open" | "closed";
  readonly before: number;
  readonly after: number;
  readonly ladder: readonly number[];
  readonly spendId?: string;
}

export interface D6DestinySpendV1 {
  readonly id: string;
  readonly key: string;
  readonly coinId: string;
  readonly userId: string;
  readonly side: D6DestinyFace;
  readonly kind: D6DestinyEffectKind | "flashback";
  readonly effectId: string;
}

export interface D6DestinyTemptationV1 {
  readonly id: string;
  readonly actorId: string;
  readonly userId: string;
  readonly frameworkId: string;
  readonly resourceRoleId: string;
  readonly ownerId: string;
  readonly sessionId: string;
  readonly poolRevision: number;
  readonly faces: readonly D6DestinyFace[];
  readonly status:
    "sampled" | "rolling" | "resisted" | "applying" | "failed" | "clear";
  readonly die?: number;
  readonly diceClaimed?: boolean;
  readonly diceArtifact?: string;
  readonly originalWild?: number;
  readonly adjudicated?: boolean;
  readonly plan?: D6ExtraordinaryPowerRollPlanV1;
  readonly checks?: readonly {
    readonly itemId: string;
    readonly roleId: string;
    readonly difficulty: number;
  }[];
  readonly rollRequests?: Readonly<Record<string, D6RollRequestV1>>;
  readonly rollResults?: Readonly<Record<string, D6RollResultV1>>;
  readonly completed?: boolean;
  readonly recovery?: { readonly userId: string; readonly reason: string };
}

/** This complete authority record is GM-private; expose only a redacted view. */
export interface D6DestinyStateV1 {
  readonly version: 1;
  readonly revision: number;
  readonly sessionId: string;
  readonly status: "uninitialized" | "awaiting-roll" | "active";
  readonly nominatedUserId: string;
  readonly sessionRoll?: number;
  readonly sessionRollClaim?: string;
  readonly coins: readonly D6DestinyCoinV1[];
  readonly proposals: Readonly<Record<string, D6DestinyProposalV1>>;
  readonly effects: Readonly<Record<string, D6DestinyEffectV1>>;
  readonly spends: readonly D6DestinySpendV1[];
  readonly temptations: Readonly<Record<string, D6DestinyTemptationV1>>;
  readonly frameworkEdits?: Readonly<Record<string, D6DestinyFrameworkEditV1>>;
  readonly archives?: Readonly<
    Record<
      string,
      {
        readonly proposals: Readonly<Record<string, D6DestinyProposalV1>>;
        readonly spends: readonly D6DestinySpendV1[];
      }
    >
  >;
  readonly receipts: Readonly<
    Record<string, { readonly userId: string; readonly command: string }>
  >;
}

export interface D6DestinyPrincipal {
  readonly userId: string;
  readonly isGM: boolean;
  readonly actorIds: readonly string[];
}

export type D6DestinyOperation =
  | {
      readonly kind: "framework-edit";
      readonly edit: Omit<D6DestinyFrameworkEditV1, "status" | "userId">;
    }
  | {
      readonly kind: "framework-edited";
      readonly editId: string;
      readonly error?: string;
    }
  | {
      readonly kind: "reset";
      readonly sessionId: string;
      readonly size: number;
      readonly nominatedUserId: string;
    }
  | { readonly kind: "claim-session-roll"; readonly claimId: string }
  | { readonly kind: "session-roll"; readonly die: number }
  | {
      readonly kind: "correct";
      readonly faces: readonly D6DestinyFace[];
      readonly reason: string;
    }
  | {
      readonly kind: "propose";
      readonly proposal: Pick<
        D6DestinyProposalV1,
        | "id"
        | "actorId"
        | "coinId"
        | "story"
        | "situation"
        | "request"
        | "equipmentRequested"
      >;
    }
  | {
      readonly kind: "revise";
      readonly proposalId: string;
      readonly actorId?: string;
      readonly equipmentRequested?: boolean;
      readonly story: string;
      readonly situation: string;
      readonly request: string;
    }
  | {
      readonly kind: "review";
      readonly proposalId: string;
      readonly decision: "revision" | "reject" | "approve";
      readonly review: string;
      readonly delivery?: D6DestinyDeliveryV1;
    }
  | { readonly kind: "cancel"; readonly proposalId: string }
  | {
      readonly kind: "delivered";
      readonly proposalId: string;
      readonly itemFingerprint?: string;
      readonly itemId?: string;
    }
  | {
      readonly kind: "cleanup-delivery";
      readonly sessionId: string;
      readonly proposalId: string;
      readonly status: "removed" | "retained" | "missing";
    }
  | {
      readonly kind: "open-effect";
      readonly effect: Omit<D6DestinyEffectV1, "status" | "spendId" | "after">;
    }
  | { readonly kind: "close-effect"; readonly effectId: string }
  | {
      readonly kind: "spend";
      readonly effectId: string;
      readonly coinId: string;
    }
  | {
      readonly kind: "sample";
      readonly activation: Pick<
        D6DestinyTemptationV1,
        | "id"
        | "actorId"
        | "frameworkId"
        | "resourceRoleId"
        | "ownerId"
        | "checks"
        | "rollResults"
        | "plan"
      >;
    }
  | {
      readonly kind: "claim-power-roll";
      readonly activationId: string;
      readonly index: number;
      readonly request: D6RollRequestV1;
    }
  | {
      readonly kind: "record-power-roll";
      readonly activationId: string;
      readonly index: number;
      readonly result: D6RollResultV1;
    }
  | { readonly kind: "complete-power"; readonly activationId: string }
  | {
      readonly kind: "tempt";
      readonly activationId: string;
      readonly originalWild: number;
    }
  | { readonly kind: "claim-temptation-dice"; readonly activationId: string }
  | {
      readonly kind: "save-temptation-dice";
      readonly activationId: string;
      readonly artifact: string;
    }
  | {
      readonly kind: "temptation-roll";
      readonly activationId: string;
      readonly die: number;
    }
  | { readonly kind: "consequence-applied"; readonly activationId: string }
  | {
      readonly kind: "recover-temptation";
      readonly activationId: string;
      readonly die: number;
      readonly reason: string;
    }
  | {
      readonly kind: "abandon-power";
      readonly activationId: string;
      readonly reason: string;
    }
  | { readonly kind: "adjudicate"; readonly activationId: string };

export interface D6DestinyCommandV1 {
  readonly version: 1;
  readonly id: string;
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly operation: D6DestinyOperation;
}

export interface D6DestinyTemptationContributionV1 {
  readonly version: 1;
  readonly consequenceResourceRoleId: string;
  readonly label: string;
}

export interface D6DestinyFrameworkPatchV1 {
  readonly field:
    | "skillBindings"
    | "powerBindings"
    | "consequenceValues"
    | "maintainedPowerIds";
  readonly key: string;
  readonly before: string | number | readonly string[] | null;
  readonly after: string | number | readonly string[] | null;
}
export interface D6DestinyFrameworkEditV1 {
  readonly id: string;
  readonly actorId: string;
  readonly frameworkId: string;
  readonly userId: string;
  readonly patches: readonly D6DestinyFrameworkPatchV1[];
  readonly status: "pending" | "applied" | "rejected";
  readonly error?: string;
}
