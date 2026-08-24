import type { D6RollInvocationOptionsV1, D6RollResultV1 } from "./roll";

export const D6_EXPLOSIVE_WORKFLOW_CONTRACT_VERSION = 1 as const;

export interface D6ExplosiveBeginOptionsV1 {
  readonly handling?: "manual" | "native-placement";
  readonly roll?: D6RollInvocationOptionsV1;
  readonly tokenId?: string;
}

export interface D6System2eExplosivesApi {
  begin(
    actor: object,
    itemId: string,
    options?: D6ExplosiveBeginOptionsV1,
  ): Promise<D6RollResultV1 | null>;
  cancel(region: object): Promise<void>;
  detonate(region: object): Promise<void>;
  read(region: object): D6ExplosiveWorkflowReadV1 | null;
}

export interface D6ExplosiveWorkflowReadV1 {
  readonly contractVersion: typeof D6_EXPLOSIVE_WORKFLOW_CONTRACT_VERSION;
  readonly rangeBand: "point-blank" | "short" | "medium" | "long" | null;
  readonly requestId: string;
  readonly status: "aiming" | "armed" | "resolved" | "detonated" | "cancelled";
  readonly timing: "immediate" | "end-of-round";
}
