import type {
  D6RollMode,
  D6RollRequestV1,
  D6RollResultV1,
  ResolveD6RollInput,
} from "@d6-system-2e/core";
import type { D6InitiatingActionRollEvidenceV1 } from "./initiating-action-results";

/** Internal workflow contract. It does not select an edition, strategy or model. */
export interface FirstEditionActorBinding {
  readonly actorId: string;
  readonly actorUuid: string;
  readonly sceneId?: string;
  readonly tokenUuid?: string;
}
export interface FirstEditionQuantity<U extends string> {
  readonly value: number;
  readonly unit: U;
}
export interface FirstEditionPixelPoint {
  readonly x: number;
  readonly y: number;
  readonly unit: "pixels";
}
export interface FirstEditionClockBinding {
  readonly checkId: string;
  readonly combatUuid?: string;
  readonly completedRounds: FirstEditionQuantity<"rounds">;
  readonly elapsedMinutes: FirstEditionQuantity<"minutes">;
}
export type FirstEditionHealthSnapshot =
  | { readonly kind: "wounds"; readonly stateId: string }
  | {
      readonly kind: "body-points";
      readonly current: FirstEditionQuantity<"points">;
      readonly maximum: FirstEditionQuantity<"points">;
      readonly derivedWoundStateId?: string;
    };
export type FirstEditionEffectPlan =
  | {
      readonly kind: "token-translation";
      readonly actorUuid: string;
      readonly sceneId: string;
      readonly tokenUuid: string;
      readonly from: FirstEditionPixelPoint;
      readonly to: FirstEditionPixelPoint;
      readonly distance: FirstEditionQuantity<"meters">;
      /** The consumer must verify compatibility; this contract converts nothing. */
      readonly measurement: {
        readonly sceneUnits: string;
        readonly gridDistance: number;
        readonly gridSize: number;
      };
    }
  | {
      readonly kind: "action-spend" | "segment-movement" | "ordered-completion";
      readonly actorUuid: string;
      readonly combatUuid: string;
      readonly combatantUuid: string;
      readonly expectedRevision: number;
      readonly actions: FirstEditionQuantity<"actions">;
      readonly distance?: FirstEditionQuantity<"meters">;
    }
  | {
      readonly kind: "health-change";
      readonly actorUuid: string;
      readonly healthModelId: string;
      readonly before: FirstEditionHealthSnapshot;
      readonly after: FirstEditionHealthSnapshot;
      readonly clock?: FirstEditionClockBinding;
      readonly rest?: FirstEditionQuantity<"minutes" | "days" | "weeks">;
    }
  | {
      readonly kind: "mortality-clock";
      readonly actorUuid: string;
      readonly healthModelId: string;
      readonly before: FirstEditionClockBinding;
      readonly after: FirstEditionClockBinding;
    }
  | {
      readonly kind: "item-score-change";
      readonly actorUuid: string;
      readonly itemUuid: string;
      readonly before: FirstEditionQuantity<"pips">;
      readonly after: FirstEditionQuantity<"pips">;
    };
export type FirstEditionRollPurpose =
  | "movement"
  | "segment-running"
  | "natural-healing"
  | "medicine"
  | "body-point-amount"
  | "survival"
  | "duration";
export type FirstEditionStageSpec = {
  readonly controllerUserId: string;
  readonly subject: FirstEditionActorBinding;
} & (
  | {
      readonly kind: "d6-roll";
      readonly purpose: Exclude<FirstEditionRollPurpose, "body-point-amount">;
      readonly unit: "check" | "minutes";
      readonly source: {
        readonly attributeId: string;
        readonly itemId?: string;
      };
      readonly fixedDifficulty?: number;
      readonly fixedScore?: number;
    }
  | {
      readonly kind: "plain-d6";
      readonly purpose: "body-point-amount";
      readonly unit: "points";
      readonly dice: number;
    }
  | { readonly kind: "effect"; readonly plan: FirstEditionEffectPlan }
);
export type FirstEditionRollRuntime = Pick<
  ResolveD6RollInput,
  "profileId" | "successEvaluator" | "wildPolicy" | "wildTriumph"
>;
export type FirstEditionClaimInput =
  | {
      readonly kind: "d6-roll";
      readonly request: D6RollRequestV1;
      readonly runtime: FirstEditionRollRuntime;
    }
  | {
      readonly kind: "plain-d6";
      readonly dice: number;
      readonly rollMode: D6RollMode;
    }
  | { readonly kind: "effect" };
/** Structurally compatible with the neutral Foundry serializer, without importing it. */
export interface FirstEditionSerializedRoll {
  readonly version: 1;
  readonly evidence: D6InitiatingActionRollEvidenceV1;
  readonly serialized: string;
}
export type FirstEditionStageReceipt =
  | {
      readonly kind: "d6-roll";
      readonly result: D6RollResultV1;
      readonly artifacts: readonly FirstEditionSerializedRoll[];
    }
  | {
      readonly kind: "plain-d6";
      readonly total: number;
      readonly faces: readonly number[];
      readonly artifacts: readonly FirstEditionSerializedRoll[];
    }
  | {
      readonly kind: "effect";
      /** Issued by the authoritative document/command compare-and-apply port. */
      readonly receiptKey: string;
      readonly plan: FirstEditionEffectPlan;
      readonly outcome: "applied" | "no-change";
      readonly authorityReceiptId: string;
    };
export interface FirstEditionActionStage {
  readonly id: string;
  readonly spec: FirstEditionStageSpec;
  readonly state: "pending" | "claimed" | "recorded";
  readonly claim?: FirstEditionClaimInput;
  readonly receipt?: FirstEditionStageReceipt;
}
export interface FirstEditionActionRoot {
  readonly version: 1;
  readonly rootMessageId: string;
  readonly operationId: string;
  readonly initiation:
    "movement" | "healing" | "manual-mortality" | "round-mortality";
  readonly coordinatorUserId: string;
  readonly subjects: readonly {
    readonly role: "mover" | "patient" | "healer";
    readonly actor: FirstEditionActorBinding;
  }[];
  readonly status: "open" | "cancelled" | "complete";
  readonly revision: number;
  readonly runtime: {
    readonly profileId: string;
    readonly movementStrategyId?: string;
    readonly actionEconomyStrategyId?: string;
    readonly healthModelId?: string;
    readonly damageStrategyId?: string;
    readonly roundLifecycleId?: string;
  };
  readonly clock?: FirstEditionClockBinding;
  readonly stages: readonly FirstEditionActionStage[];
}
