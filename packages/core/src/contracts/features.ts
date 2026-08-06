export const D6_FEATURE_SESSION_CONTRACT_VERSION = 1 as const;
export const D6_FEATURE_SESSION_MAX_USES = 2 as const;

export type D6NarrativeFeatureChoice = "hero-point" | "roll-bonus";

export interface D6FeatureSessionStateV1 {
  readonly contractVersion: typeof D6_FEATURE_SESSION_CONTRACT_VERSION;
  readonly revision: number;
  readonly sessionId: string;
  readonly uses: Readonly<Record<string, number>>;
}

export interface D6FeatureInvocationV1 {
  readonly choice?: D6NarrativeFeatureChoice;
  readonly expectedRevision: number;
}

export interface D6FeatureCommandResultV1 {
  readonly changed: boolean;
  readonly complicationRequired: boolean;
  readonly heroPointDelta: 0 | 1;
  readonly itemId: string;
  readonly rollBonusScore: 0 | 9;
  readonly state: D6FeatureSessionStateV1;
}

export interface D6System2eFeatureApi {
  invoke(
    actor: object,
    itemId: string,
    invocation: D6FeatureInvocationV1,
  ): Promise<D6FeatureCommandResultV1>;
  read(actor: object): D6FeatureSessionStateV1;
  reset(
    actor: object,
    expectedRevision: number,
  ): Promise<D6FeatureSessionStateV1>;
}
